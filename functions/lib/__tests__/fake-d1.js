// In-memory fake of the Cloudflare D1 API used by tests.
//
// Supports the SQL subset used by the admin backend:
//   CREATE TABLE IF NOT EXISTS ...
//   CREATE [UNIQUE] INDEX IF NOT EXISTS ... (no-op)
//   INSERT [OR IGNORE] INTO t (cols) VALUES (...), (...)
//   INSERT INTO t (cols) VALUES (...) ON CONFLICT(col) DO UPDATE SET ...
//   SELECT cols FROM t [WHERE ...] [ORDER BY ...] [LIMIT n]
//   SELECT COUNT(*) / SUM(col) / COALESCE(SUM(col), 0) ... FROM t [WHERE ...]
//   UPDATE t SET col = <expr> WHERE ...
//   DELETE FROM t WHERE ...
//   db.batch(statements)
//
// WHERE supports =, >=, <=, >, <, LIKE with AND / OR (no parentheses).

const splitTopLevel = (text, separator) => {
  const parts = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth === 0 && text.startsWith(separator, i)) {
      parts.push(current);
      current = "";
      i += separator.length - 1;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
};

const applyUpsertSet = (existing, incoming, setClause) => {
  for (const assignment of splitTopLevel(setClause, ",")) {
    const eq = assignment.indexOf("=");
    const column = assignment.slice(0, eq).trim();
    const expression = assignment.slice(eq + 1).trim();
    const excludedRef = expression.match(/^excluded\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (excludedRef) {
      existing[column] = incoming[excludedRef[1]];
      continue;
    }
    const plusNumber = expression.match(
      /^[a-zA-Z_][a-zA-Z0-9_]*\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\+\s*(-?\d+)$/,
    );
    if (plusNumber) {
      existing[column] = Number(existing[plusNumber[1]]) + Number(plusNumber[2]);
      continue;
    }
    const plusExcluded = expression.match(
      /^[a-zA-Z_][a-zA-Z0-9_]*\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\+\s*excluded\.([a-zA-Z_][a-zA-Z0-9_]*)$/,
    );
    if (plusExcluded) {
      existing[column] =
        Number(existing[plusExcluded[1]]) + Number(incoming[plusExcluded[2]]);
      continue;
    }
    existing[column] = toScalar(expression);
  }
};

const stripQuotes = (value) =>
  value.startsWith("'") && value.endsWith("'")
    ? value.slice(1, -1)
    : value;

const toScalar = (value) => {
  const trimmed = value.trim();
  // Unquoted SQL NULL literal → real null (so IS NULL matches it).
  if (/^NULL$/i.test(trimmed)) return null;
  const stripped = stripQuotes(trimmed);
  if (/^-?\d+(\.\d+)?$/.test(stripped)) return Number(stripped);
  return stripped;
};

const looseEq = (a, b) =>
  typeof a === "number" && typeof b === "number" ? a === b : String(a) === String(b);

const compareValues = (a, b) => {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
};

const matchLike = (pattern, value) => {
  const escaped = String(pattern).replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped.replace(/%/g, ".*").replace(/_/g, ".")}$`);
  return regex.test(String(value));
};

const parseCondition = (condition, bindings, bindIndex) => {
  // IS NULL / IS NOT NULL (used for simple-product stock rows and galleries).
  const nullMatch = condition.match(
    /^([a-zA-Z_][a-zA-Z0-9_]*)\s*(IS NULL|IS NOT NULL)$/i,
  );
  if (nullMatch) {
    const [, column, operator] = nullMatch;
    const matcher = (row) =>
      operator.toUpperCase() === "IS NULL"
        ? row[column] == null
        : row[column] != null;
    return { matcher, bindIndex };
  }

  const match = condition.match(
    /^([a-zA-Z_][a-zA-Z0-9_]*)\s*(>=|<=|>|<|=|LIKE)\s*(\?|'[^']*'|-?\d+(\.\d+)?)$/i,
  );
  if (!match) {
    throw new Error(`Unsupported WHERE condition: ${condition}`);
  }
  const [, column, operator, token] = match;
  const value = token === "?" ? bindings[bindIndex++] : toScalar(token);
  const matcher = (row) => {
    const actual = row[column];
    switch (operator.toUpperCase()) {
      case "=":
        return looseEq(actual, value);
      case ">=":
        return compareValues(actual, value) >= 0;
      case "<=":
        return compareValues(actual, value) <= 0;
      case ">":
        return compareValues(actual, value) > 0;
      case "<":
        return compareValues(actual, value) < 0;
      case "LIKE":
        return matchLike(value, actual);
      default:
        return false;
    }
  };
  return { matcher, bindIndex };
};

const parseConditions = (whereClause, bindings, bindIndex) => {
  // Outer groups are ORed; each group is an AND chain whose elements may be
  // parenthesized OR groups, e.g. (id = ? OR slug = ?) AND active = 1.
  const groups = splitTopLevel(whereClause, " OR ").map((group) =>
    group.trim(),
  );

  const groupMatchers = groups.map((group) => {
    const andParts = splitTopLevel(group, " AND ")
      .map((part) => part.trim())
      .filter(Boolean);

    const subMatchers = andParts.map((part) => {
      if (part.startsWith("(") && part.endsWith(")")) {
        const orParts = splitTopLevel(part.slice(1, -1), " OR ")
          .map((inner) => inner.trim())
          .filter(Boolean);
        const innerMatchers = orParts.map((inner) => {
          const parsed = parseCondition(inner, bindings, bindIndex);
          bindIndex = parsed.bindIndex;
          return parsed.matcher;
        });
        return (row) => innerMatchers.some((matcher) => matcher(row));
      }
      const parsed = parseCondition(part, bindings, bindIndex);
      bindIndex = parsed.bindIndex;
      return parsed.matcher;
    });

    return (row) => subMatchers.every((matcher) => matcher(row));
  });

  return {
    matches: (row) => groupMatchers.some((matcher) => matcher(row)),
    bindIndex,
  };
};

const parseOrderBy = (clause) =>
  splitTopLevel(clause, ",").map((part) => {
    const match = part.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(ASC|DESC)?$/i);
    if (!match) return null;
    return { column: match[1], direction: (match[2] || "ASC").toUpperCase() };
  });

export function createFakeD1() {
  const tables = new Map();

  const rowsOf = (name) => {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name);
  };

  const runSql = (sql, bindings = []) => {
    const statement = sql.replace(/\s+/g, " ").trim();

    let    match = statement.match(
      /^CREATE TABLE IF NOT EXISTS ([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*\)$/i,
    );
    if (match) {
      rowsOf(match[1]);
      return { success: true };
    }

    match = statement.match(
      /^CREATE (?:UNIQUE )?INDEX IF NOT EXISTS ([a-zA-Z_][a-zA-Z0-9_]*)\s+ON\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]+)\)$/i,
    );
    if (match) {
      rowsOf(match[2]);
      return { success: true };
    }

    match = statement.match(
      /^INSERT(?: OR IGNORE)? INTO ([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]+)\)\s*VALUES\s*(.+)$/i,
    );
    if (match) {
      const tableName = match[1];
      const columns = splitTopLevel(match[2], ",").map((column) =>
        column.trim().replace(/`|"/g, ""),
      );
      const ignore = /INSERT OR IGNORE/i.test(statement);
      const upsertMatch = statement.match(
        /ON CONFLICT\s*\(([^)]+)\)\s*DO UPDATE SET\s+(.+)$/i,
      );
      const conflictColumn = upsertMatch ? upsertMatch[1].trim() : null;
      const valuesText = upsertMatch
        ? match[3].slice(0, match[3].indexOf("ON CONFLICT"))
        : match[3];
      const tupleTexts = [...valuesText.matchAll(/\(([^)]*)\)/g)].map(
        (tuple) => tuple[1],
      );
      let bindIndex = 0;
      let inserted = 0;
      for (const clean of tupleTexts) {
        const tokens = splitTopLevel(clean, ",").map((token) => token.trim());
        if (tokens.length !== columns.length) {
          throw new Error(`Column/tuple arity mismatch in: ${statement}`);
        }
        const row = {};
        for (let i = 0; i < tokens.length; i += 1) {
          const token = tokens[i];
          row[columns[i]] = token === "?" ? bindings[bindIndex++] : toScalar(token);
        }
        const existing = rowsOf(tableName).find(
          (candidate) =>
            looseEq(candidate.id, row.id) ||
            (conflictColumn && looseEq(candidate[conflictColumn], row[conflictColumn])),
        );
        if (existing && ignore) continue;
        if (existing && conflictColumn) {
          // Upsert: apply the DO UPDATE SET assignments to the matched row.
          applyUpsertSet(existing, row, upsertMatch[2]);
          inserted += 1;
          continue;
        }
        rowsOf(tableName).push(row);
        inserted += 1;
      }
      return {
        success: true,
        meta: { changes: inserted, last_row_id: inserted },
      };
    }

    match = statement.match(
      /^SELECT (.+?) FROM ([a-zA-Z_][a-zA-Z0-9_]*)(?: WHERE (.+?))?(?: ORDER BY (.+?))?(?: LIMIT (\d+|\?)(?: OFFSET (\d+|\?))?)?$/i,
    );
    if (match) {
      const [
        ,
        selectList,
        tableName,
        whereClause,
        orderByClause,
        limitText,
        offsetText,
      ] = match;
      let bindIndex = 0;
      let predicate = { matches: () => true };
      if (whereClause) {
        const parsed = parseConditions(whereClause, bindings, bindIndex);
        predicate = parsed;
        bindIndex = parsed.bindIndex;
      }

      let matched = rowsOf(tableName).filter((row) => predicate.matches(row));

      if (orderByClause) {
        const keys = parseOrderBy(orderByClause).filter(Boolean);
        matched = matched.sort((a, b) => {
          for (const key of keys) {
            const result = compareValues(a[key.column], b[key.column]);
            if (result !== 0) {
              return key.direction === "DESC" ? -result : result;
            }
          }
          return 0;
        });
      }

      let limit = null;
      if (limitText) {
        limit = limitText === "?" ? Number(bindings[bindIndex++]) : Number(limitText);
      }
      let offset = 0;
      if (offsetText) {
        // OFFSET is always the last bind value, so a plain read is enough.
        offset = offsetText === "?" ? Number(bindings[bindIndex]) : Number(offsetText);
      }
      if (offset) matched = matched.slice(offset);
      if (limit) matched = matched.slice(0, limit);

      // Aggregate select (COUNT / SUM).
      const countMatch = selectList.match(/COUNT\(\*\)/i);
      const sumMatches = [...selectList.matchAll(/COALESCE\(SUM\(([a-zA-Z_][a-zA-Z0-9_]*)\)\s*,\s*0\)|SUM\(([a-zA-Z_][a-zA-Z0-9_]*)\)/gi)];
      if (countMatch || sumMatches.length) {
        const alias = (part, fallback) => {
          const aliasMatch = part.match(/AS\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
          return aliasMatch ? aliasMatch[1] : fallback;
        };
        const row = {};
        const parts = splitTopLevel(selectList, ",");
        for (const part of parts) {
          if (/COUNT\(\*\)/i.test(part)) {
            row[alias(part, "count")] = matched.length;
          }
          const sumPart = part.match(/SUM\(([a-zA-Z_][a-zA-Z0-9_]*)\)/i);
          if (sumPart) {
            const total = matched.reduce(
              (acc, r) => acc + (Number(r[sumPart[1]]) || 0),
              0,
            );
            const coalesce = /COALESCE/i.test(part);
            row[alias(part, sumPart[1])] =
              coalesce || matched.length ? total : null;
          }
        }
        return { success: true, results: [row] };
      }

      const project = (row) => {
        if (selectList.trim() === "*") return { ...row };
        const output = {};
        for (const part of splitTopLevel(selectList, ",")) {
          const column = part.trim().replace(/`|"/g, "");
          const aliasMatch = column.match(/^(.+?)\s+AS\s+([a-zA-Z_][a-zA-Z0-9_]*)$/i);
          if (aliasMatch) {
            output[aliasMatch[2]] = row[aliasMatch[1].trim()];
          } else {
            output[column] = row[column];
          }
        }
        return output;
      };

      return { success: true, results: matched.map(project) };
    }

    match = statement.match(
      /^UPDATE ([a-zA-Z_][a-zA-Z0-9_]*)\s+SET\s+(.+?)(?: WHERE (.+))?$/i,
    );
    if (match) {
      const [, tableName, setClause, whereClause] = match;
      const assignments = splitTopLevel(setClause, ",").map((part) => {
        const eq = part.indexOf("=");
        const column = part.slice(0, eq).trim();
        const expression = part.slice(eq + 1).trim();
        return { column, expression };
      });

      // SET bind values come before WHERE bind values in the SQL text.
      let bindIndex = 0;
      const setBindValues = [];
      for (const { expression } of assignments) {
        if (/\?/.test(expression)) setBindValues.push(bindings[bindIndex++]);
      }

      let predicate = { matches: () => true };
      if (whereClause) {
        predicate = parseConditions(whereClause, bindings, bindIndex);
      }

      let setIndex = 0;
      const evaluate = (expression, row) => {
        const trimmed = expression.trim();
        if (trimmed === "?") return setBindValues[setIndex++];
        const decrement = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*-\s*\?$/);
        if (decrement) return Number(row[decrement[1]]) - setBindValues[setIndex++];
        const increment = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\+\s*\?$/);
        if (increment) return Number(row[increment[1]]) + setBindValues[setIndex++];
        const decrementLiteral = trimmed.match(
          /^([a-zA-Z_][a-zA-Z0-9_]*)\s*-\s*(-?\d+(\.\d+)?)$/,
        );
        if (decrementLiteral) {
          return Number(row[decrementLiteral[1]]) - Number(decrementLiteral[2]);
        }
        const incrementLiteral = trimmed.match(
          /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\+\s*(-?\d+(\.\d+)?)$/,
        );
        if (incrementLiteral) {
          return Number(row[incrementLiteral[1]]) + Number(incrementLiteral[2]);
        }
        return toScalar(trimmed);
      };

      const store = rowsOf(tableName);
      let changes = 0;
      for (const row of store) {
        if (!predicate.matches(row)) continue;
        for (const { column, expression } of assignments) {
          row[column] = evaluate(expression, row);
        }
        changes += 1;
      }
      return { success: true, meta: { changes, last_row_id: 0 } };
    }

    match = statement.match(
      /^DELETE FROM ([a-zA-Z_][a-zA-Z0-9_]*)(?: WHERE (.+))?$/i,
    );
    if (match) {
      const [, tableName, whereClause] = match;
      let bindIndex = 0;
      let predicate = { matches: () => true };
      if (whereClause) {
        predicate = parseConditions(whereClause, bindings, bindIndex);
      }
      const store = rowsOf(tableName);
      const remaining = store.filter((row) => !predicate.matches(row));
      const changes = store.length - remaining.length;
      tables.set(tableName, remaining);
      return { success: true, meta: { changes, last_row_id: 0 } };
    }

    throw new Error(`Fake D1: unsupported SQL: ${statement}`);
  };

  const prepare = (sql) => {
    const statement = {
      _sql: sql,
      values: [],
      bind(...args) {
        statement.values = args;
        return statement;
      },
      async all() {
        const result = runSql(sql, statement.values);
        return { success: true, results: result.results || [] };
      },
      async first() {
        const result = runSql(sql, statement.values);
        return (result.results && result.results[0]) || null;
      },
      async run() {
        return runSql(sql, statement.values);
      },
      async execute() {
        return runSql(sql, statement.values);
      },
    };
    return statement;
  };

  return {
    prepare,
    async batch(statements) {
      const results = [];
      for (const statement of statements) {
        const sql = statement._sql;
        const result = runSql(sql, statement.values);
        results.push(result);
      }
      return results;
    },
    async exec(sql) {
      for (const piece of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
        runSql(piece);
      }
      return { success: true };
    },
    // Test introspection helpers.
    _tables: tables,
    _rows: (name) => rowsOf(name).map((row) => ({ ...row })),
  };
}
