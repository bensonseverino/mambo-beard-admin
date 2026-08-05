// In-memory fake of the Cloudflare D1 API used by tests.
//
// Supports the SQL subset used by the admin backend:
//   CREATE TABLE IF NOT EXISTS ...
//   INSERT [OR IGNORE] INTO t (cols) VALUES (...), (...)
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

const stripQuotes = (value) =>
  value.startsWith("'") && value.endsWith("'")
    ? value.slice(1, -1)
    : value;

const toScalar = (value) => {
  const stripped = stripQuotes(value.trim());
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

    let match = statement.match(
      /^CREATE TABLE IF NOT EXISTS ([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*\)$/i,
    );
    if (match) {
      rowsOf(match[1]);
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
      const tupleTexts = [...match[3].matchAll(/\(([^)]*)\)/g)].map(
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
        const existing = rowsOf(tableName).find((candidate) =>
          looseEq(candidate.id, row.id),
        );
        if (existing && ignore) continue;
        rowsOf(tableName).push(row);
        inserted += 1;
      }
      return {
        success: true,
        meta: { changes: inserted, last_row_id: inserted },
      };
    }

    match = statement.match(
      /^SELECT (.+?) FROM ([a-zA-Z_][a-zA-Z0-9_]*)(?: WHERE (.+?))?(?: ORDER BY (.+?))?(?: LIMIT (\d+))?$/i,
    );
    if (match) {
      const [, selectList, tableName, whereClause, orderByClause, limitText] =
        match;
      let bindIndex = 0;
      let predicate = { matches: () => true };
      if (whereClause) {
        predicate = parseConditions(whereClause, bindings, bindIndex);
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

      const limit = limitText ? Number(limitText) : null;
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
        if (expression === "?") return setBindValues[setIndex++];
        const decrement = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*-\s*\?$/);
        if (decrement) return Number(row[decrement[1]]) - setBindValues[setIndex++];
        const increment = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\+\s*\?$/);
        if (increment) return Number(row[increment[1]]) + setBindValues[setIndex++];
        return toScalar(expression);
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
