import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import "./App.css";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/products", label: "Products" },
  { to: "/orders", label: "Orders" },
  { to: "/customers", label: "Customers" },
  { to: "/subscribers", label: "Subscribers" },
  { to: "/inventory", label: "Inventory" },
  { to: "/collections", label: "Collections" },
  { to: "/settings", label: "Settings" },
];

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "packing",
  "shipped",
  "delivered",
  "cancelled",
];

const STATUS_STYLES = {
  pending: "bg-amber-500/15 text-amber-300",
  confirmed: "bg-sky-500/15 text-sky-300",
  packing: "bg-violet-500/15 text-violet-300",
  shipped: "bg-blue-500/15 text-blue-300",
  delivered: "bg-emerald-500/15 text-emerald-300",
  cancelled: "bg-rose-500/15 text-rose-300",
};

const statusLabel = (status) =>
  status ? String(status).charAt(0).toUpperCase() + String(status).slice(1) : "—";

const statusStyle = (status) =>
  STATUS_STYLES[String(status || "").toLowerCase()] ||
  "bg-slate-500/15 text-slate-300";

// SQLite CURRENT_TIMESTAMP stores UTC as "YYYY-MM-DD HH:MM:SS"; parse it as
// UTC so displayed times convert correctly to the admin's local timezone.
const parseDbDate = (value) => {
  if (!value) return null;
  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(text)
    ? new Date(`${text.replace(" ", "T")}Z`)
    : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => {
  const date = parseDbDate(value);
  if (!date) return value ? String(value) : "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDay = (value) => {
  const date = parseDbDate(value);
  if (!date) return value ? String(value) : "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const apiFetch = async (path, options = {}) => {
  const token = localStorage.getItem("mambo-admin-token") || "";
  const headers = { ...(options.headers || {}) };
  headers.Authorization = `Bearer ${token}`;
  if (options.body) headers["Content-Type"] = "application/json";
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload.message || payload.error || `Request failed (${response.status})`,
    );
  }
  return payload;
};

const REFRESH_INTERVAL_MS = 45000;

// Per-product variation configuration. The admin dashboard is the source of
// truth; the storefront renders only the selectors that apply to each value.
const VARIATION_OPTIONS = [
  {
    value: "none",
    label: "No variations",
    description: "One price and a single stock quantity. No selectors.",
    badge: "bg-sky-500/15 text-sky-300",
  },
  {
    value: "color",
    label: "Color only",
    description: "Customers pick a color. No size selector.",
    badge: "bg-emerald-500/15 text-emerald-300",
  },
  {
    value: "size",
    label: "Size only",
    description: "Customers pick a size (S–XXL). No color selector.",
    badge: "bg-violet-500/15 text-violet-300",
  },
  {
    value: "color_size",
    label: "Color + Size",
    description: "Customers pick both a color and a size.",
    badge: "bg-amber-500/15 text-amber-300",
  },
];

const variationLabel = (value) =>
  VARIATION_OPTIONS.find((option) => option.value === value)?.label ||
  value ||
  "Color + Size";

const variationBadge = (value) =>
  VARIATION_OPTIONS.find((option) => option.value === value)?.badge ||
  "bg-amber-500/15 text-amber-300";

const hasColorVariation = (type) => type === "color" || type === "color_size";
const hasSizeVariation = (type) => type === "size" || type === "color_size";

const resolveVariationType = (product) =>
  VARIATION_OPTIONS.some((option) => option.value === product?.variationType)
    ? product.variationType
    : product?.productType === "simple"
      ? "none"
      : "color_size";

// Fallback size catalog used when /api/sizes is unavailable. The live
// catalog comes from the API so new sizes need no code changes.
const FALLBACK_SIZE_NAMES = ["S", "M", "L", "XL", "XXL"];
const FALLBACK_SIZE_CATALOG = FALLBACK_SIZE_NAMES.map((name) => ({
  id: `size-${name.toLowerCase()}`,
  name,
}));

// Pseudo key for the simple-product gallery upload queue (there are no
// colors, so images are tracked against the product itself).
const GALLERY_KEY = "__gallery__";

const createSeedState = () => ({
  products: [
    {
      id: "prod-1",
      name: "Classic Beard Oil",
      slug: "classic-beard-oil",
      description: "A cedar-scented blend for daily grooming.",
      price: 24,
      category: "Care",
      featured: true,
      active: true,
      variationType: "color_size",
      colors: [
        {
          id: "color-1",
          name: "Amber",
          hex: "#b97a1b",
          sortOrder: 1,
          images: [
            "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80",
          ],
          variants: [
            { size: "S", stock: 4 },
            { size: "M", stock: 10 },
            { size: "L", stock: 8 },
            { size: "XL", stock: 2 },
            { size: "XXL", stock: 0 },
          ],
        },
      ],
      sizes: [
        { id: "size-s", name: "S" },
        { id: "size-m", name: "M" },
        { id: "size-l", name: "L" },
        { id: "size-xl", name: "XL" },
        { id: "size-xxl", name: "XXL" },
      ],
    },
    {
      id: "prod-2",
      name: "Precision Beard Trimmer",
      slug: "precision-beard-trimmer",
      description: "Rechargeable trimmer with ergonomic grip.",
      price: 89,
      category: "Tools",
      featured: false,
      active: true,
      variationType: "color_size",
      colors: [
        {
          id: "color-2",
          name: "Matte Black",
          hex: "#111827",
          sortOrder: 1,
          images: [
            "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
          ],
          variants: [
            { size: "S", stock: 2 },
            { size: "M", stock: 6 },
            { size: "L", stock: 7 },
            { size: "XL", stock: 4 },
            { size: "XXL", stock: 3 },
          ],
        },
      ],
      sizes: [
        { id: "size-s", name: "S" },
        { id: "size-m", name: "M" },
        { id: "size-l", name: "L" },
        { id: "size-xl", name: "XL" },
        { id: "size-xxl", name: "XXL" },
      ],
    },
  ],
  orders: [],
  collections: [
    {
      id: "col-1",
      name: "Summer Grooming",
      slug: "summer-grooming",
      description: "Hydrating essentials for hot-weather routines.",
      featured: true,
      productIds: ["prod-1"],
    },
    {
      id: "col-2",
      name: "Precision Tools",
      slug: "precision-tools",
      description: "Everyday staples for sculpted lines.",
      featured: false,
      productIds: ["prod-2"],
    },
  ],
  customers: [],
  settings: {
    whatsapp: "+1 555 0199",
    deliveryZones: ["Downtown", "North Loop", "Riverside"],
    deliveryFees: { Downtown: 4, "North Loop": 6, Riverside: 5 },
    socials: {
      instagram: "https://www.instagram.com/mambobrand",
      facebook: "https://www.facebook.com/mambobrand",
      tiktok: "https://www.tiktok.com/@mambobrand",
    },
    banner: "Free local delivery on orders over $75 this week.",
  },
});

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const acceptedImageTypes = ["image/webp", "image/jpeg", "image/png", "image/gif", "image/avif", "image/tiff", "image/bmp"];

// Uploads every image as-is in its original format.
const reencodeImage = async (file) => {
  // Every image is uploaded as-is in its original format.
  // No canvas re-encoding is performed — format, animation, and
  // metadata are all preserved exactly.
  return null;
};
const imageTypeOptions = [
  "front",
  "back",
  "detail",
  "model",
  "lifestyle",
  "gallery",
];

const isGifImage = (image) => {
  const name = (image.fileName || image.path || "").toLowerCase();
  return name.endsWith(".gif") || name.includes(".gif?");
};

const formatBytes = (value) => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const slugifyValue = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const normalizeColorImages = (images) => {
  if (!Array.isArray(images)) return [];
  return images.map((image, index) => {
    if (typeof image === "string") {
      return {
        id: `image-${index + 1}`,
        path: image,
        previewUrl: image,
        type: "gallery",
        fileName: image.split("/").pop() || `gallery-${index + 1}.webp`,
        size: 0,
        uploadedAt: new Date().toISOString(),
        isPrimary: index === 0,
        sortOrder: index + 1,
      };
    }
    return {
      id: image.id || `image-${index + 1}`,
      path: image.path || "",
      previewUrl: image.previewUrl || image.path || "",
      type: image.type || "gallery",
      fileName:
        image.fileName ||
        image.path?.split("/").pop() ||
        `gallery-${index + 1}.webp`,
      size: image.size || 0,
      uploadedAt: image.uploadedAt || new Date().toISOString(),
      isPrimary: Boolean(image.isPrimary),
      sortOrder: image.sortOrder || index + 1,
    };
  });
};

const createColorTemplate = (index, sizes = FALLBACK_SIZE_NAMES) => ({
  id: `color-${Date.now()}-${index}`,
  name: `Color ${index + 1}`,
  hex: "#111827",
  sortOrder: index + 1,
  images: [],
  // Empty sizes means a color-only product: one stock figure per color.
  variants: sizes.length
    ? sizes.map((size) => ({ size, stock: 0 }))
    : [{ size: null, stock: 0 }],
});

const getProductValidation = (product) => {
  const errors = [];
  const variationType = resolveVariationType(product);
  const hasColor = hasColorVariation(variationType);
  const hasSize = hasSizeVariation(variationType);

  if (!product.name?.trim()) errors.push("Add a product name.");
  if (!product.slug?.trim()) errors.push("Add a slug.");
  if (!product.price || Number(product.price) <= 0) {
    errors.push("Enter a price greater than zero.");
  }

  // No variations: only a stock quantity and a color-less gallery apply.
  if (variationType === "none") {
    const stock = Number(product.stock);
    if (!Number.isFinite(stock) || stock < 0) {
      errors.push("Enter a valid stock quantity.");
    }
    const images = normalizeColorImages(product.gallery);
    if (!images.length) {
      errors.push("Add at least one gallery image.");
    } else if (!images.some((image) => image.isPrimary)) {
      errors.push("Set a primary gallery image.");
    }
    return errors;
  }

  if (hasColor) {
    if (!product.colors?.length) errors.push("Add at least one color.");
    product.colors?.forEach((color, index) => {
      if (!color.name?.trim()) {
        errors.push(`Color ${index + 1} needs a name.`);
      }
      const images = normalizeColorImages(color.images);
      if (!images.length) {
        errors.push(`Color ${index + 1} needs at least one uploaded image.`);
      } else if (!images.some((image) => image.isPrimary)) {
        errors.push(`Color ${index + 1} needs a primary image.`);
      }
      if (variationType === "color_size") {
        if (!color.variants?.length) {
          errors.push(`Color ${index + 1} needs at least one size selected.`);
        }
        const hasInventory = color.variants?.every((variant) => {
          const stock = Number(variant.stock);
          return Number.isFinite(stock) && stock >= 0;
        });
        if (!hasInventory) {
          errors.push(
            `Color ${index + 1} needs inventory values for every size.`,
          );
        }
      } else {
        const stock = Number(color.variants?.[0]?.stock);
        if (!Number.isFinite(stock) || stock < 0) {
          errors.push(`Color ${index + 1} needs a valid stock quantity.`);
        }
      }
    });
  }

  if (hasSize) {
    const activeSizes = (product.sizes || []).filter(
      (size) => size.enabled !== false,
    );
    if (!activeSizes.length) {
      errors.push("Select at least one size.");
    }
    if (variationType === "size") {
      activeSizes.forEach((size) => {
        const stock = Number(size.stock);
        if (!Number.isFinite(stock) || stock < 0) {
          errors.push(`Size ${size.name || ""} needs a valid stock quantity.`);
        }
      });
    }
  }
  return errors;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<ProtectedApp />} />
      </Routes>
    </BrowserRouter>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });

  const handleSubmit = (event) => {
    event.preventDefault();
    const token = `admin-${form.email.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
    localStorage.setItem("mambo-admin-token", token);
    localStorage.setItem(
      "mambo-admin-auth",
      JSON.stringify({ email: form.email, name: "Mambo Admin" }),
    );
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.28),transparent_40%),linear-gradient(135deg,#020617_0%,#111827_100%)] px-4 py-12 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur lg:flex-row lg:p-12">
        <div className="flex-1 space-y-6">
          <div className="inline-flex rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-300">
            Mambo Beard Admin Portal
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Secure control center for your storefront.
            </h1>
            <p className="max-w-xl text-lg text-slate-300">
              Manage products, inventory, collections, orders, and customer
              insights from one polished dashboard.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-semibold text-white">
                Protected by token auth
              </p>
              <p className="mt-1">
                Write endpoints require a valid admin session.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-semibold text-white">Cloudflare Pages ready</p>
              <p className="mt-1">
                Pages Functions handle API routes without a worker.
              </p>
            </div>
          </div>
        </div>
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-xl"
        >
          <h2 className="text-2xl font-semibold text-white">Sign in</h2>
          <p className="mt-2 text-sm text-slate-400">
            Use any email and password to continue.
          </p>
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-200">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none ring-0"
                placeholder="admin@mambobrand.com"
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none ring-0"
                placeholder="••••••••"
                required
              />
            </label>
          </div>
          <button
            type="submit"
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-amber-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-400"
          >
            Continue to dashboard
          </button>
        </form>
      </div>
    </div>
  );
}

function ProtectedApp() {
  const [state, setState] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mambo-admin-state");
      return saved ? JSON.parse(saved) : createSeedState();
    }
    return createSeedState();
  });
  const [auth, setAuth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mambo-admin-auth");
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  useEffect(() => {
    localStorage.setItem("mambo-admin-state", JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (auth) {
      localStorage.setItem("mambo-admin-auth", JSON.stringify(auth));
    }
  }, [auth]);

  useEffect(() => {
    if (!auth) return;

    const loadProducts = async () => {
      try {
        const token = localStorage.getItem("mambo-admin-token") || "";
        // includeInactive=1 lets the admin see and restore soft-deleted
        // products; the storefront catalog still only gets active ones.
        const response = await fetch("/api/products?includeInactive=1", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = await response.json();
        if (response.ok && payload.success) {
          setState((current) => ({
            ...current,
            products: payload.data || [],
          }));
        }
      } catch (error) {
        console.error("Failed to load products", error);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    void loadProducts();
  }, [auth]);

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    localStorage.removeItem("mambo-admin-auth");
    localStorage.removeItem("mambo-admin-token");
    setAuth(null);
  };

  const updateState = (updater) => {
    setState((current) => updater(current));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="w-full border-b border-white/10 bg-slate-900/80 px-4 py-6 lg:w-72 lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
          <div className="flex items-center justify-between lg:block">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-400">
                Mambo Beard
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Admin</h2>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 lg:mt-4"
            >
              Logout
            </button>
          </div>
          <nav className="mt-8 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-amber-500/15 text-amber-300"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">
                Operations hub
              </p>
              <h1 className="text-3xl font-semibold text-white">
                Mambo Beard Admin Dashboard
              </h1>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
              Signed in as{" "}
              <span className="font-semibold text-white">{auth.name}</span>
            </div>
          </div>
          <Routes>
            <Route path="/" element={<DashboardView />} />
            <Route
              path="/products"
              element={<ProductsView state={state} updateState={updateState} isLoadingProducts={isLoadingProducts} />}
            />
            <Route path="/orders" element={<OrdersView />} />
            <Route path="/inventory" element={<InventoryView />} />
            <Route
              path="/collections"
              element={
                <CollectionsView state={state} updateState={updateState} />
              }
            />
            <Route path="/customers" element={<CustomersView />} />
            <Route path="/subscribers" element={<SubscribersView />} />
            <Route
              path="/settings"
              element={<SettingsView state={state} updateState={updateState} />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function DashboardView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const payload = await apiFetch("/api/dashboard");
      if (requestSeq.current !== seq) return;
      setData(payload.data);
      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      if (requestSeq.current !== seq) return;
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const metrics = [
    {
      label: "Today's orders",
      value: data ? data.todayOrders : "—",
      hint: "Orders placed today",
    },
    {
      label: "Today's revenue",
      value: data ? formatCurrency(data.todayRevenue) : "—",
      hint: "Revenue since midnight",
    },
    {
      label: "Total customers",
      value: data ? data.totalCustomers : "—",
      hint: "Registered on checkout",
    },
    {
      label: "Pending orders",
      value: data ? data.pendingOrders : "—",
      hint: "Awaiting confirmation",
    },
    {
      label: "Low stock products",
      value: data ? data.lowStockCount : "—",
      hint: "2 or fewer units left",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          {error ? (
            <span className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-rose-300">
              {error}
            </span>
          ) : (
            <>
              Auto-refreshes every 45 seconds
              {lastUpdated ? (
                <span className="ml-2 text-slate-500">
                  • Updated {lastUpdated.toLocaleTimeString()}
                </span>
              ) : null}
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            void load();
          }}
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
        >
          <span className={refreshing ? "animate-spin" : ""}>⟳</span>
          Refresh
        </button>
      </div>

      {loading && !data ? (
        <p className="text-sm text-slate-400">Loading dashboard metrics…</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                hint={metric.hint}
              />
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Recent orders
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    The latest purchases from your storefront.
                  </p>
                </div>
                <Link
                  to="/orders"
                  className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/5"
                >
                  View all
                </Link>
              </div>
              <div className="mt-6 space-y-3">
                {data?.recentOrders?.length ? (
                  data.recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 transition hover:border-amber-400/30"
                    >
                      <div>
                        <p className="font-medium text-white">
                          {order.customerName || "—"}
                        </p>
                        <p className="text-sm text-slate-400">
                          {order.orderNumber || order.id} •{" "}
                          {formatDay(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-white">
                          {formatCurrency(order.total)}
                        </p>
                        <p className={`text-sm ${statusStyle(order.status)}`}>
                          {statusLabel(order.status)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">
                    No orders yet — they will appear here automatically after
                    checkout.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">
                  Low-stock products
                </h2>
                <Link
                  to="/inventory"
                  className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/5"
                >
                  Manage
                </Link>
              </div>
              <div className="mt-6 space-y-3">
                {data?.lowStockProducts?.length ? (
                  data.lowStockProducts.map((item) => (
                    <div
                      key={item.inventoryId}
                      className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3"
                    >
                      <p className="font-medium text-white">
                        {item.productName}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {item.colorName ? `${item.colorName} • ` : ""}
                        {item.size ? `Size ${item.size} • ` : ""}
                        {item.stock} units left
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">
                    Everything looks well stocked.
                  </p>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function ProductsView({ state, updateState, isLoadingProducts }) {
  const [draft, setDraft] = useState({
    id: "",
    name: "",
    slug: "",
    description: "",
    price: "",
    category: "Care",
    featured: false,
    active: true,
    variationType: "color_size",
    colors: [],
    sizes: [],
    gallery: [],
    stock: "",
  });
  const [uploadQueues, setUploadQueues] = useState({});
  const [typeFilter, setTypeFilter] = useState("all");
  const [sizeCatalog, setSizeCatalog] = useState(FALLBACK_SIZE_CATALOG);
  // Bulk upload: target color and image type for the global drop zone.
  const [bulkColorId, setBulkColorId] = useState("");
  const [bulkImageType, setBulkImageType] = useState("front");
  // Drag-over highlight for the global drop zone.
  const [bulkDragOver, setBulkDragOver] = useState(false);

  // Load the size catalog from the API so new sizes need no code changes.
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/sizes")
      .then((payload) => {
        if (!cancelled && Array.isArray(payload.data) && payload.data.length) {
          setSizeCatalog(payload.data);
        }
      })
      .catch(() => {
        // Fall back to the standard S–XXL catalog.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const variationType = resolveVariationType(draft);
  const hasColor = hasColorVariation(variationType);
  const hasSize = hasSizeVariation(variationType);

  // The sizes the draft currently tracks; when none are tracked yet, every
  // catalog size is assumed enabled so the form starts fully unchecked-free.
  const activeSizes = useMemo(() => {
    if (draft.sizes?.length) return draft.sizes;
    return sizeCatalog.map((size) => ({
      id: size.id,
      name: size.name,
      enabled: true,
      stock: 0,
    }));
  }, [draft.sizes, sizeCatalog]);

  const visibleProducts = useMemo(() => {
    if (typeFilter === "all") return state.products;
    return state.products.filter(
      (product) => resolveVariationType(product) === typeFilter,
    );
  }, [state.products, typeFilter]);

  const validationMessages = useMemo(
    () => getProductValidation(draft),
    [draft],
  );
  const isPublishable = validationMessages.length === 0;

  const saveProduct = async (event) => {
    event.preventDefault();
    const selectedSizes = activeSizes.filter((size) => size.enabled !== false);
    const normalized = {
      ...draft,
      id: draft.id || `prod-${Date.now()}`,
      slug: slugifyValue(draft.slug || draft.name),
      price: Number(draft.price) || 0,
      variationType,
      stock:
        variationType === "none"
          ? Math.max(0, Number(draft.stock) || 0)
          : undefined,
      gallery: !hasColor ? normalizeColorImages(draft.gallery) : undefined,
      sizes: hasSize
        ? selectedSizes.map((size) => ({
            id: size.id,
            name: size.name,
            stock:
              variationType === "size" ? Number(size.stock) || 0 : undefined,
          }))
        : [],
      colors: hasColor
        ? draft.colors.length
          ? draft.colors.map((color) => ({
              ...color,
              images: normalizeColorImages(color.images),
              variants:
                variationType === "color"
                  ? [
                      {
                        size: null,
                        stock: Math.max(
                          0,
                          Number(color.variants?.[0]?.stock) || 0,
                        ),
                      },
                    ]
                  : (color.variants || []).map((variant) => ({
                      ...variant,
                      stock: Number(variant.stock) || 0,
                    })),
            }))
          : [
              createColorTemplate(
                0,
                variationType === "color_size"
                  ? selectedSizes.map((size) => size.name)
                  : [],
              ),
            ]
        : [],
    };

    // Changing the variation type of an existing product can orphan or
    // reinterpret inventory — warn before rebuilding it.
    if (draft.id) {
      const existing = state.products.find((product) => product.id === draft.id);
      const existingType = existing ? resolveVariationType(existing) : null;
      if (existingType && existingType !== variationType) {
        const confirmed = window.confirm(
          "Changing the variation type may affect existing inventory data. Continue?",
        );
        if (!confirmed) return;
      }
    }

    try {
      const token = localStorage.getItem("mambo-admin-token") || "";
      const method = draft.id ? "PUT" : "POST";
      const url = draft.id ? `/api/products/${draft.id}` : "/api/products";
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(normalized),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to save product");
      }

      const savedProduct = payload.data;
      updateState((current) => ({
        ...current,
        products: draft.id
          ? current.products.map((product) =>
              product.id === draft.id ? savedProduct : product,
            )
          : [...current.products, savedProduct],
      }));
      setDraft({
        id: "",
        name: "",
        slug: "",
        description: "",
        price: "",
        category: "Care",
        featured: false,
        active: true,
        variationType: "color_size",
        colors: [],
        sizes: [],
        gallery: [],
        stock: "",
      });
    } catch (error) {
      console.error("Unable to save product", error);
    }
  };

  const changeVariationType = (nextType) => {
    setDraft((current) => {
      const currentType = resolveVariationType(current);
      if (currentType === nextType) return current;

      const nextHasColor = hasColorVariation(nextType);
      const nextHasSize = hasSizeVariation(nextType);
      const currentHasColor = hasColorVariation(currentType);

      let colors = current.colors || [];
      let gallery = normalizeColorImages(current.gallery);

      // Leaving a color mode: flatten every color's images into the gallery
      // so no uploads are orphaned by the rebuild.
      if (currentHasColor && !nextHasColor) {
        const flattened = (current.colors || []).flatMap((color) =>
          normalizeColorImages(color.images),
        );
        gallery = gallery.length ? gallery : flattened;
        colors = [];
      }

      // color_size → color: collapse the matrix into one stock per color.
      if (currentType === "color_size" && nextType === "color") {
        colors = colors.map((color) => ({
          ...color,
          variants: [
            {
              size: null,
              stock: color.variants?.[0]?.stock ?? 0,
            },
          ],
        }));
      }

      // color → color_size: expand one stock per color into every size.
      if (currentType === "color" && nextType === "color_size") {
        const sizeNames = current.sizes?.length
          ? current.sizes
              .filter((size) => size.enabled !== false)
              .map((size) => size.name)
          : FALLBACK_SIZE_NAMES;
        colors = colors.map((color) => ({
          ...color,
          variants: sizeNames.map((name) => ({
            size: name,
            stock: color.variants?.[0]?.stock ?? 0,
          })),
        }));
      }

      // Entering a color mode from none: move the gallery into the first
      // color so assets stay attached.
      if (!currentHasColor && nextHasColor) {
        if (
          gallery.length &&
          !colors.some((color) =>
            normalizeColorImages(color.images).length,
          )
        ) {
          if (!colors.length) {
            colors = [
              {
                ...createColorTemplate(0, nextType === "color_size" ? FALLBACK_SIZE_NAMES : []),
                images: gallery,
              },
            ];
          } else {
            colors = colors.map((color, index) =>
              index === 0 ? { ...color, images: gallery } : color,
            );
          }
        }
        gallery = [];
      }

      let sizes = current.sizes || [];
      if (nextHasSize && !sizes.length) {
        sizes = sizeCatalog.map((size) => ({
          id: size.id,
          name: size.name,
          enabled: true,
          stock: 0,
        }));
      }
      if (!nextHasSize) {
        sizes = [];
      }

      return {
        ...current,
        variationType: nextType,
        colors,
        sizes,
        gallery,
      };
    });
  };

  const toggleSize = (size) => {
    setDraft((current) => {
      const currentActive = current.sizes?.length ? current.sizes : activeSizes;
      const isEnabled = currentActive.some(
        (entry) => entry.id === size.id && entry.enabled !== false,
      );
      const nextSizes = currentActive.map((entry) =>
        entry.id === size.id
          ? { ...entry, enabled: !isEnabled }
          : entry,
      );

      if (current.variationType === "color_size") {
        // Keep every color's inventory matrix in sync with the selection.
        const colors = (current.colors || []).map((color) => ({
          ...color,
          variants: isEnabled
            ? (color.variants || []).filter(
                (variant) => variant.size !== size.name,
              )
            : [
                ...(color.variants || []),
                { size: size.name, stock: 0 },
              ],
        }));
        return { ...current, sizes: nextSizes, colors };
      }

      return { ...current, sizes: nextSizes };
    });
  };

  const updateSizeStock = (sizeId, nextStock) => {
    setDraft((current) => {
      const currentActive = current.sizes?.length ? current.sizes : activeSizes;
      return {
        ...current,
        sizes: currentActive.map((entry) =>
          entry.id === sizeId
            ? { ...entry, stock: Number(nextStock) || 0 }
            : entry,
        ),
      };
    });
  };

  const removeProduct = async (productId) => {
    try {
      const token = localStorage.getItem("mambo-admin-token") || "";
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to delete product");
      }

      // Soft delete: the product stays in the admin list, marked inactive,
      // so order history and inventory are preserved.
      updateState((current) => ({
        ...current,
        products: current.products.map((product) =>
          product.id === productId ? { ...product, active: false } : product,
        ),
      }));
    } catch (error) {
      console.error("Unable to delete product", error);
    }
  };

  const restoreProduct = async (productId) => {
    try {
      const token = localStorage.getItem("mambo-admin-token") || "";
      const response = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: true }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to restore product");
      }

      updateState((current) => ({
        ...current,
        products: current.products.map((product) =>
          product.id === productId ? { ...product, active: true } : product,
        ),
      }));
    } catch (error) {
      console.error("Unable to restore product", error);
    }
  };

  const updateColor = (colorId, changes) => {
    setDraft((current) => ({
      ...current,
      colors: current.colors.map((color) =>
        color.id === colorId ? { ...color, ...changes } : color,
      ),
    }));
  };

  const addColor = () => {
    setDraft((current) => {
      const currentType = resolveVariationType(current);
      const sizeNames = hasSizeVariation(currentType)
        ? (current.sizes?.length
            ? current.sizes.filter((size) => size.enabled !== false)
            : sizeCatalog.map((size) => ({ ...size, enabled: true }))
          ).map((size) => size.name)
        : [];
      return {
        ...current,
        colors: [
          ...current.colors,
          createColorTemplate(current.colors.length, sizeNames),
        ],
      };
    });
  };

  const removeColor = (colorId) => {
    setDraft((current) => ({
      ...current,
      colors: current.colors.filter((color) => color.id !== colorId),
    }));
  };

  const updateVariantStock = (colorId, size, nextStock) => {
    setDraft((current) => ({
      ...current,
      colors: current.colors.map((color) =>
        color.id === colorId
          ? {
              ...color,
              variants: color.variants.map((variant) =>
                variant.size === size
                  ? { ...variant, stock: Number(nextStock) || 0 }
                  : variant,
              ),
            }
          : color,
      ),
    }));
  };

  const updateColorStock = (colorId, nextStock) => {
    setDraft((current) => ({
      ...current,
      colors: current.colors.map((color) =>
        color.id === colorId
          ? {
              ...color,
              variants: [{ size: null, stock: Number(nextStock) || 0 }],
            }
          : color,
      ),
    }));
  };

  const enqueueUploads = async (colorId, files, imageType) => {
    // Pass every file through reencodeImage (currently a no-op that
    // returns the original file as-is in its original format).
    const converted = await Promise.all(
      Array.from(files).map(async (file) => {
        const fixed = await reencodeImage(file);
        return fixed || file;
      }),
    );

    const colorQueue = converted.map((file, index) => ({
      id: `${colorId}-${Date.now()}-${index}`,
      file,
      imageType,
      previewUrl: URL.createObjectURL(file),
      status: "queued",
      progress: 0,
      error: "",
      fileName: file.name,
      size: file.size,
    }));

    setUploadQueues((current) => ({
      ...current,
      [colorId]: [...(current[colorId] || []), ...colorQueue],
    }));

    colorQueue.forEach((queueItem) => {
      void uploadQueueItem(colorId, queueItem);
    });
  };

  const addImageToColor = async (colorId, files, imageType = "front") => {
    const color = draft.colors.find((item) => item.id === colorId);
    if (!color) return;
    enqueueUploads(colorId, files, imageType);
  };

  const addImageToGallery = (files, imageType = "gallery") => {
    enqueueUploads(GALLERY_KEY, files, imageType);
  };

  // ── Bulk upload handlers ─────────────────────────────────────────────
  // The global drop zone at the top of the Images section lets admins
  // drop many files at once into a chosen color, without scrolling to
  // each per-color section.

  const handleBulkDrop = (event) => {
    event.preventDefault();
    setBulkDragOver(false);
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length) return;
    const targetId = bulkColorId || draft.colors[0]?.id;
    if (!targetId) return;
    void addImageToColor(targetId, files, bulkImageType);
  };

  const handleBulkFileSelection = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const targetId = bulkColorId || draft.colors[0]?.id;
    if (!targetId) return;
    void addImageToColor(targetId, files, bulkImageType);
    event.target.value = "";
  };

  // Aggregate upload stats across all colors for the summary bar.
  const bulkStats = useMemo(() => {
    let total = 0;
    let uploading = 0;
    let completed = 0;
    let errors = 0;
    for (const queue of Object.values(uploadQueues)) {
      for (const item of queue) {
        total++;
        if (item.status === "error") errors++;
        else if (item.progress >= 100) completed++;
        else uploading++;
      }
    }
    const avgProgress = total
      ? Object.values(uploadQueues).flat().reduce((sum, i) => sum + i.progress, 0) / total
      : 0;
    return { total, uploading, completed, errors, avgProgress };
  }, [uploadQueues]);

  const uploadQueueItem = async (colorId, queueItem) => {
    const isGallery = colorId === GALLERY_KEY;
    const color = isGallery
      ? null
      : draft.colors.find((item) => item.id === colorId);
    if (!isGallery && !color) return;

    const token = localStorage.getItem("mambo-admin-token") || "";

    setUploadQueues((current) => ({
      ...current,
      [colorId]: (current[colorId] || []).map((item) =>
        item.id === queueItem.id
          ? { ...item, status: "uploading", progress: 12 }
          : item,
      ),
    }));

    const progressInterval = window.setInterval(() => {
      setUploadQueues((current) => ({
        ...current,
        [colorId]: (current[colorId] || []).map((item) => {
          if (item.id !== queueItem.id) return item;
          const nextProgress = Math.min(item.progress + 18, 92);
          return { ...item, progress: nextProgress };
        }),
      }));
    }, 180);

    try {
      const formData = new FormData();
      formData.append("file", queueItem.file);
      formData.append("productSlug", draft.slug || "product");
      // Simple products upload into a single color-less gallery folder.
      formData.append("colorName", isGallery ? "gallery" : color.name || "color");
      formData.append("gallery", isGallery ? "1" : "0");
      formData.append("imageType", queueItem.imageType);

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Upload failed");
      }

      const existingImages = normalizeColorImages(
        isGallery ? draft.gallery : color.images,
      );
      const uploadedImage = {
        id: `${queueItem.id}-uploaded`,
        path: payload.path,
        previewUrl: queueItem.previewUrl,
        type: queueItem.imageType,
        fileName: queueItem.fileName,
        size: queueItem.size,
        uploadedAt: new Date().toISOString(),
        isPrimary: !existingImages.length,
        sortOrder: existingImages.length + 1,
      };

      setDraft((current) => {
        if (isGallery) {
          return {
            ...current,
            gallery: [...normalizeColorImages(current.gallery), uploadedImage],
          };
        }
        return {
          ...current,
          colors: current.colors.map((item) => {
            if (item.id !== colorId) return item;
            const nextImages = normalizeColorImages(item.images);
            return {
              ...item,
              images: [...nextImages, uploadedImage],
            };
          }),
        };
      });

      setUploadQueues((current) => ({
        ...current,
        [colorId]: (current[colorId] || []).filter(
          (item) => item.id !== queueItem.id,
        ),
      }));
    } catch (error) {
      setUploadQueues((current) => ({
        ...current,
        [colorId]: (current[colorId] || []).map((item) =>
          item.id === queueItem.id
            ? { ...item, status: "error", progress: 100, error: error.message }
            : item,
        ),
      }));
    } finally {
      window.clearInterval(progressInterval);
      if (queueItem.previewUrl) {
        URL.revokeObjectURL(queueItem.previewUrl);
      }
    }
  };

  const retryUpload = (colorId, queueItemId) => {
    const queueItem = (uploadQueues[colorId] || []).find(
      (item) => item.id === queueItemId,
    );
    if (!queueItem) return;
    void uploadQueueItem(colorId, {
      ...queueItem,
      status: "queued",
      progress: 0,
      error: "",
    });
  };

  const cancelUpload = (colorId, queueItemId) => {
    setUploadQueues((current) => ({
      ...current,
      [colorId]: (current[colorId] || []).filter(
        (item) => item.id !== queueItemId,
      ),
    }));
  };

  const updateImage = (colorId, imageId, changes) => {
    setDraft((current) => ({
      ...current,
      colors: current.colors.map((color) => {
        if (color.id !== colorId) return color;
        return {
          ...color,
          images: normalizeColorImages(color.images).map((image) =>
            image.id === imageId ? { ...image, ...changes } : image,
          ),
        };
      }),
    }));
  };

  const removeImage = (colorId, imageId) => {
    setDraft((current) => ({
      ...current,
      colors: current.colors.map((color) => {
        if (color.id !== colorId) return color;
        const nextImages = normalizeColorImages(color.images).filter(
          (image) => image.id !== imageId,
        );
        const shouldSetPrimary =
          nextImages.length && !nextImages.some((image) => image.isPrimary);
        return {
          ...color,
          images: nextImages.map((image, index) => ({
            ...image,
            isPrimary: shouldSetPrimary && index === 0 ? true : image.isPrimary,
            sortOrder: index + 1,
          })),
        };
      }),
    }));
  };

  const setPrimaryImage = (colorId, imageId) => {
    setDraft((current) => ({
      ...current,
      colors: current.colors.map((color) => {
        if (color.id !== colorId) return color;
        return {
          ...color,
          images: normalizeColorImages(color.images).map((image) => ({
            ...image,
            isPrimary: image.id === imageId,
          })),
        };
      }),
    }));
  };

  const replaceImage = async (colorId, currentImage, file) => {
    const color = draft.colors.find((item) => item.id === colorId);
    if (!color) return;
    const queueItem = {
      id: `${colorId}-${Date.now()}`,
      file,
      imageType: currentImage.type,
      previewUrl: URL.createObjectURL(file),
      status: "queued",
      progress: 0,
      error: "",
      fileName: file.name,
      size: file.size,
    };
    setUploadQueues((current) => ({
      ...current,
      [colorId]: [...(current[colorId] || []), queueItem],
    }));
    await uploadQueueItem(colorId, queueItem);
    setDraft((current) => ({
      ...current,
      colors: current.colors.map((item) => {
        if (item.id !== colorId) return item;
        const nextImages = normalizeColorImages(item.images);
        return {
          ...item,
          images: nextImages.map((image) =>
            image.id === currentImage.id
              ? { ...image, path: image.path, previewUrl: image.previewUrl }
              : image,
          ),
        };
      }),
    }));
  };

  const handleFileSelection = (event, colorId, imageType) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    void addImageToColor(colorId, files, imageType);
    event.target.value = "";
  };

  const handleDrop = (event, colorId, imageType) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length) return;
    void addImageToColor(colorId, files, imageType);
  };

  const handleGalleryFileSelection = (event, imageType) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    void addImageToGallery(files, imageType);
    event.target.value = "";
  };

  const handleGalleryDrop = (event, imageType) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length) return;
    void addImageToGallery(files, imageType);
  };

  const updateGalleryImage = (imageId, changes) => {
    setDraft((current) => ({
      ...current,
      gallery: normalizeColorImages(current.gallery).map((image) =>
        image.id === imageId ? { ...image, ...changes } : image,
      ),
    }));
  };

  const removeGalleryImage = (imageId) => {
    setDraft((current) => {
      const nextImages = normalizeColorImages(current.gallery).filter(
        (image) => image.id !== imageId,
      );
      const shouldSetPrimary =
        nextImages.length && !nextImages.some((image) => image.isPrimary);
      return {
        ...current,
        gallery: nextImages.map((image, index) => ({
          ...image,
          isPrimary: shouldSetPrimary && index === 0 ? true : image.isPrimary,
          sortOrder: index + 1,
        })),
      };
    });
  };

  const setPrimaryGalleryImage = (imageId) => {
    setDraft((current) => ({
      ...current,
      gallery: normalizeColorImages(current.gallery).map((image) => ({
        ...image,
        isPrimary: image.id === imageId,
      })),
    }));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Products</h2>
            <p className="mt-1 text-sm text-slate-400">
              Create, update, and retire product listings from one place.
            </p>
          </div>
        </div>
        <form onSubmit={saveProduct} className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <h3 className="text-lg font-semibold text-white">
              Product Variations
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              How can customers choose this product? Only the options below
              appear on the storefront.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {VARIATION_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    variationType === option.value
                      ? "border-amber-400/40 bg-amber-500/10"
                      : "border-white/10 bg-slate-900/70 hover:border-white/25"
                  }`}
                >
                  <input
                    type="radio"
                    name="variation-type"
                    className="sr-only"
                    checked={variationType === option.value}
                    onChange={() => changeVariationType(option.value)}
                  />
                  <span className="block">
                    <span className="font-semibold text-white">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-sm text-slate-400">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <h3 className="text-lg font-semibold text-white">
              Product Details
            </h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="text-sm font-medium text-slate-200">
                Name
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      name: event.target.value,
                      slug: slugifyValue(event.target.value),
                    })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-white"
                  required
                />
              </label>
              <label className="text-sm font-medium text-slate-200">
                Slug
                <input
                  value={draft.slug}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      slug: slugifyValue(event.target.value),
                    })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-white"
                  required
                />
              </label>
              <label className="text-sm font-medium text-slate-200 lg:col-span-2">
                Description
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                  className="mt-2 min-h-28 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-white"
                  required
                />
              </label>
              <label className="text-sm font-medium text-slate-200">
                Price
                <input
                  type="number"
                  value={draft.price}
                  onChange={(event) =>
                    setDraft({ ...draft, price: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-white"
                  required
                />
              </label>
              <label className="text-sm font-medium text-slate-200">
                Category
                <input
                  value={draft.category}
                  onChange={(event) =>
                    setDraft({ ...draft, category: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-white"
                  required
                />
              </label>
            </div>
          </div>

          {hasColor ? (
            <>
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Colors</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Each color owns its own media gallery and inventory.
                </p>
              </div>
              <button
                type="button"
                onClick={addColor}
                className="rounded-full border border-amber-500/30 px-3 py-2 text-sm font-medium text-amber-300"
              >
                + Add Color
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {draft.colors.map((color, index) => {
                return (
                  <div
                    key={color.id}
                    className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: color.hex }}
                        />
                        <div>
                          <p className="font-medium text-white">
                            {color.name || `Color ${index + 1}`}
                          </p>
                          <p className="text-sm text-slate-400">
                            Sort order {color.sortOrder}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeColor(color.id)}
                        className="rounded-full border border-rose-500/20 px-3 py-1.5 text-sm text-rose-300"
                      >
                        Remove Color
                      </button>
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <label className="text-sm font-medium text-slate-200">
                        Color name
                        <input
                          value={color.name}
                          onChange={(event) =>
                            updateColor(color.id, { name: event.target.value })
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-white"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-200">
                        Hex value
                        <input
                          type="color"
                          value={color.hex}
                          onChange={(event) =>
                            updateColor(color.id, { hex: event.target.value })
                          }
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-700 bg-slate-950/80"
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-200">
                        Sort order
                        <input
                          type="number"
                          value={color.sortOrder}
                          onChange={(event) =>
                            updateColor(color.id, {
                              sortOrder: Number(event.target.value) || 1,
                            })
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-white"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <h3 className="text-lg font-semibold text-white">Images</h3>
            <p className="mt-1 text-sm text-slate-400">
              Each color manages its own gallery and one primary image.
            </p>

            {/* ── Bulk upload zone ──────────────────────────────────────── */}
            {draft.colors.length > 0 ? (
              <div className="mt-4 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="text-sm font-medium text-slate-200">
                    Upload to
                    <select
                      value={bulkColorId || (draft.colors[0]?.id ?? "")}
                      onChange={(event) => setBulkColorId(event.target.value)}
                      className="ml-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      {draft.colors.map((color) => (
                        <option key={color.id} value={color.id}>
                          {color.name || "Unnamed"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-200">
                    Image type
                    <select
                      value={bulkImageType}
                      onChange={(event) => setBulkImageType(event.target.value)}
                      className="ml-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      {imageTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="cursor-pointer rounded-full border border-amber-500/30 px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/10">
                    <input
                      type="file"
                      accept={acceptedImageTypes.join(",")}
                      multiple
                      className="hidden"
                      onChange={handleBulkFileSelection}
                    />
                    + Choose files
                  </label>
                </div>
                <div
                  className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
                    bulkDragOver
                      ? "border-amber-400 bg-amber-500/10"
                      : "border-slate-700 bg-slate-950/70"
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setBulkDragOver(true);
                  }}
                  onDragLeave={() => setBulkDragOver(false)}
                  onDrop={handleBulkDrop}
                >
                  <p className="text-sm font-medium text-slate-200">
                    Drop multiple images here
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    WebP, JPG, PNG, GIF, AVIF, TIFF, and BMP · up to 20 MB each
                  </p>
                </div>
                {/* Aggregate upload progress bar */}
                {bulkStats.total > 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">
                        {bulkStats.uploading > 0
                          ? `Uploading ${bulkStats.uploading} of ${bulkStats.total}…`
                          : bulkStats.errors > 0
                            ? `${bulkStats.completed} done, ${bulkStats.errors} failed`
                            : `${bulkStats.total} uploaded`}
                      </span>
                      <span className="text-slate-500">
                        {Math.round(bulkStats.avgProgress)}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-800">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          bulkStats.errors > 0 && bulkStats.uploading === 0
                            ? "bg-rose-500"
                            : "bg-amber-500"
                        }`}
                        style={{ width: `${bulkStats.avgProgress}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 space-y-5">
              {draft.colors.map((color) => {
                const colorImages = normalizeColorImages(color.images);
                return (
                  <div
                    key={color.id}
                    className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-white">{color.name}</p>
                        <p className="text-sm text-slate-400">
                          {colorImages.length} uploaded image(s)
                        </p>
                      </div>
                      <div className="rounded-2xl border border-dashed border-slate-700 px-3 py-2 text-sm text-slate-300">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept={acceptedImageTypes.join(",")}
                            multiple
                            className="hidden"
                            onChange={(event) =>
                              handleFileSelection(event, color.id, "front")
                            }
                          />
                          + Upload Images
                        </label>
                      </div>
                    </div>
                    <div
                      className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-4"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDrop(event, color.id, "gallery")}
                    >
                      <p className="text-sm font-medium text-slate-200">
                        Drag and drop files here
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        WebP, JPG, JPEG, PNG, GIF, AVIF, TIFF, and BMP up to 20 MB.
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {imageTypeOptions.map((imageType) => (
                        <label
                          key={imageType}
                          className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300"
                        >
                          <input
                            type="file"
                            accept={acceptedImageTypes.join(",")}
                            multiple
                            className="hidden"
                            onChange={(event) =>
                              handleFileSelection(event, color.id, imageType)
                            }
                          />
                          {imageType}
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 space-y-3">
                      {colorImages.map((image) => (
                        <div
                          key={image.id}
                          className="rounded-2xl border border-white/10 bg-slate-950/70 p-3"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
                              {image.previewUrl ? (
                                <img
                                  src={image.previewUrl}
                                  alt={image.fileName}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <span className="text-xs text-slate-400">
                                  Preview
                                </span>
                              )}
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-300">
                                  {image.type}
                                </span>
                                {image.isPrimary ? (
                                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                                    Primary
                                  </span>
                                ) : null}
                                {isGifImage(image) ? (
                                  <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs font-medium text-purple-300">
                                    GIF
                                  </span>
                                ) : null}
                                <span className="text-xs text-slate-500">
                                  {formatBytes(image.size || 0)}
                                </span>
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm text-slate-300">
                                  Image type
                                  <select
                                    value={image.type}
                                    onChange={(event) =>
                                      updateImage(color.id, image.id, {
                                        type: event.target.value,
                                      })
                                    }
                                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                                  >
                                    {imageTypeOptions.map((type) => (
                                      <option key={type} value={type}>
                                        {type}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="text-sm text-slate-300">
                                  Path
                                  <input
                                    value={image.path}
                                    readOnly
                                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                                  />
                                </label>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPrimaryImage(color.id, image.id)
                                  }
                                  className="rounded-full border border-amber-500/30 px-3 py-1.5 text-sm text-amber-300"
                                >
                                  Set as primary
                                </button>
                                <label className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300">
                                  Replace
                                  <input
                                    type="file"
                                    accept={acceptedImageTypes.join(",")}
                                    className="hidden"
                                    onChange={(event) => {
                                      const file = event.target.files?.[0];
                                      if (file) {
                                        void replaceImage(
                                          color.id,
                                          image,
                                          file,
                                        );
                                      }
                                      event.target.value = "";
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigator.clipboard?.writeText(image.path)
                                  }
                                  className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300"
                                >
                                  Copy path
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeImage(color.id, image.id)
                                  }
                                  className="rounded-full border border-rose-500/20 px-3 py-1.5 text-sm text-rose-300"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {!colorImages.length ? (
                        <p className="text-sm text-slate-500">
                          No images yet. Upload the first asset to populate the
                          gallery.
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-4 space-y-2">
                      {uploadQueues[color.id]?.map((queueItem) => (
                        <div
                          key={queueItem.id}
                          className="rounded-2xl border border-slate-700 bg-slate-950/70 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-white">
                                {queueItem.fileName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {queueItem.imageType}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {queueItem.status === "error" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    retryUpload(color.id, queueItem.id)
                                  }
                                  className="rounded-full border border-amber-500/30 px-3 py-1.5 text-sm text-amber-300"
                                >
                                  Retry
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() =>
                                  cancelUpload(color.id, queueItem.id)
                                }
                                className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-slate-800">
                            <div
                              className="h-2 rounded-full bg-amber-500 transition-all"
                              style={{ width: `${queueItem.progress}%` }}
                            />
                          </div>
                          {queueItem.status === "error" ? (
                            <p className="mt-2 text-sm text-rose-300">
                              {queueItem.error}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <h3 className="text-lg font-semibold text-white">Inventory</h3>
            {variationType === "color_size" ? (
              <p className="mt-1 text-sm text-slate-400">
                Set stock for every color and size combination.
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-400">
                Set the stock quantity for every color.
              </p>
            )}
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {draft.colors.map((color) => (
                <div
                  key={color.id}
                  className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3.5 w-3.5 rounded-full"
                      style={{ backgroundColor: color.hex }}
                    />
                    <p className="font-medium text-white">{color.name}</p>
                  </div>
                  {variationType === "color_size" ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {color.variants?.map((variant) => (
                        <label
                          key={`${color.id}-${variant.size}`}
                          className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-300"
                        >
                          <div className="flex items-center justify-between">
                            <span>{variant.size}</span>
                            <span
                              className={`text-xs ${variant.stock === 0 ? "text-rose-300" : "text-emerald-300"}`}
                            >
                              {variant.stock === 0
                                ? "Unavailable"
                                : "In stock"}
                            </span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={variant.stock}
                            onChange={(event) =>
                              updateVariantStock(
                                color.id,
                                variant.size,
                                event.target.value,
                              )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-white"
                          />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <label className="mt-3 block rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-300">
                      <div className="flex items-center justify-between">
                        <span>Stock</span>
                        <span
                          className={`text-xs ${
                            (color.variants?.[0]?.stock ?? 0) === 0
                              ? "text-rose-300"
                              : "text-emerald-300"
                          }`}
                        >
                          {(color.variants?.[0]?.stock ?? 0) === 0
                            ? "Unavailable"
                            : "In stock"}
                        </span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={color.variants?.[0]?.stock ?? 0}
                        onChange={(event) =>
                          updateColorStock(color.id, event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-white"
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
            </>
          ) : null}

          {hasSize ? (
            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <h3 className="text-lg font-semibold text-white">Sizes</h3>
              {variationType === "size" ? (
                <p className="mt-1 text-sm text-slate-400">
                  Select the sizes customers can order and set stock for each.
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-400">
                  Select the sizes that appear for every color.
                </p>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeSizes.map((size) => {
                  const enabled = size.enabled !== false;
                  return (
                    <div
                      key={size.id}
                      className={`rounded-2xl border p-3 ${
                        enabled
                          ? "border-amber-400/30 bg-amber-500/5"
                          : "border-white/10 bg-slate-900/70 opacity-70"
                      }`}
                    >
                      <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-white">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => toggleSize(size)}
                          className="h-4 w-4 accent-amber-500"
                        />
                        {size.name}
                      </label>
                      {variationType === "size" && enabled ? (
                        <div className="mt-3">
                          <label className="text-xs text-slate-400">
                            Stock
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={size.stock ?? 0}
                            onChange={(event) =>
                              updateSizeStock(size.id, event.target.value)
                            }
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-2 py-2 text-sm text-white"
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {variationType === "none" || variationType === "size" ? (
            <>
          {variationType === "none" ? (
            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <h3 className="text-lg font-semibold text-white">
                Stock Quantity
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Total available units. Only one stock value exists for
                products without variations.
              </p>
              <input
                type="number"
                min="0"
                value={draft.stock}
                onChange={(event) =>
                  setDraft({ ...draft, stock: event.target.value })
                }
                className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-white sm:max-w-xs"
                placeholder="e.g. 53"
              />
            </div>
          ) : null}

          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Product gallery
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  One color-less gallery — no color folders needed.
                </p>
              </div>
              <div className="rounded-2xl border border-dashed border-slate-700 px-3 py-2 text-sm text-slate-300">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept={acceptedImageTypes.join(",")}
                    multiple
                    className="hidden"
                    onChange={(event) =>
                      handleGalleryFileSelection(event, "front")
                    }
                  />
                  + Upload Images
                </label>
              </div>
            </div>
            <div
              className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-4"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleGalleryDrop(event, "gallery")}
            >
              <p className="text-sm font-medium text-slate-200">
                Drag and drop files here
              </p>
              <p className="mt-1 text-sm text-slate-500">
                WebP, JPG, JPEG, PNG, GIF, AVIF, TIFF, and BMP up to 20 MB.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {imageTypeOptions.map((imageType) => (
                <label
                  key={imageType}
                  className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300"
                >
                  <input
                    type="file"
                    accept={acceptedImageTypes.join(",")}
                    multiple
                    className="hidden"
                    onChange={(event) =>
                      handleGalleryFileSelection(event, imageType)
                    }
                  />
                  {imageType}
                </label>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {normalizeColorImages(draft.gallery).map((image) => (
                <div
                  key={image.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 p-3"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
                      {image.previewUrl ? (
                        <img
                          src={image.previewUrl}
                          alt={image.fileName}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">
                          Preview
                        </span>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-300">
                          {image.type}
                        </span>
                        {image.isPrimary ? (
                          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                            Primary
                          </span>
                        ) : null}
                        {isGifImage(image) ? (
                          <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs font-medium text-purple-300">
                            GIF
                          </span>
                        ) : null}
                        <span className="text-xs text-slate-500">
                          {formatBytes(image.size || 0)}
                        </span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="text-sm text-slate-300">
                          Image type
                          <select
                            value={image.type}
                            onChange={(event) =>
                              updateGalleryImage(image.id, {
                                type: event.target.value,
                              })
                            }
                            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                          >
                            {imageTypeOptions.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-sm text-slate-300">
                          Path
                          <input
                            value={image.path}
                            readOnly
                            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setPrimaryGalleryImage(image.id)}
                          className="rounded-full border border-amber-500/30 px-3 py-1.5 text-sm text-amber-300"
                        >
                          Set as primary
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard?.writeText(image.path)
                          }
                          className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300"
                        >
                          Copy path
                        </button>
                        <button
                          type="button"
                          onClick={() => removeGalleryImage(image.id)}
                          className="rounded-full border border-rose-500/20 px-3 py-1.5 text-sm text-rose-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {!normalizeColorImages(draft.gallery).length ? (
                <p className="text-sm text-slate-500">
                  No images yet. Upload the first asset to populate the
                  gallery.
                </p>
              ) : null}
            </div>
            <div className="mt-4 space-y-2">
              {uploadQueues[GALLERY_KEY]?.map((queueItem) => (
                <div
                  key={queueItem.id}
                  className="rounded-2xl border border-slate-700 bg-slate-950/70 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {queueItem.fileName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {queueItem.imageType}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {queueItem.status === "error" ? (
                        <button
                          type="button"
                          onClick={() =>
                            retryUpload(GALLERY_KEY, queueItem.id)
                          }
                          className="rounded-full border border-amber-500/30 px-3 py-1.5 text-sm text-amber-300"
                        >
                          Retry
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          cancelUpload(GALLERY_KEY, queueItem.id)
                        }
                        className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-amber-500 transition-all"
                      style={{ width: `${queueItem.progress}%` }}
                    />
                  </div>
                  {queueItem.status === "error" ? (
                    <p className="mt-2 text-sm text-rose-300">
                      {queueItem.error}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
            </>
          ) : null}

          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Publish</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Publication is ready once the checks below pass.
                </p>
              </div>
              <div
                className={`rounded-full px-3 py-1 text-sm ${isPublishable ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}
              >
                {isPublishable ? "Ready to publish" : "Validation needed"}
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <ul className="space-y-2 text-sm text-slate-300">
                {validationMessages.length ? (
                  validationMessages.map((message) => (
                    <li
                      key={message}
                      className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-200"
                    >
                      {message}
                    </li>
                  ))
                ) : (
                  <li className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-200">
                    All required product checks passed.
                  </li>
                )}
              </ul>
            </div>
            <div className="mt-4">
              <button
                type="submit"
                className="rounded-2xl bg-amber-500 px-4 py-3 font-semibold text-slate-950"
              >
                Save product
              </button>
            </div>
          </div>
        </form>
      </section>
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        {isLoadingProducts ? (
          <p className="text-sm text-slate-400">
            Loading products from the backend…
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[
            { value: "all", label: "All" },
            ...VARIATION_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            })),
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTypeFilter(option.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                typeFilter === option.value
                  ? "border-amber-400/40 bg-amber-500/15 text-amber-300"
                  : "border-slate-700 text-slate-300 hover:bg-white/5"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-3 py-3">Product</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Price</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => {
                const rowVariationType = resolveVariationType(product);
                return (
                <tr key={product.id} className="border-t border-white/10">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">
                        {product.name}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${variationBadge(rowVariationType)}`}
                      >
                        {variationLabel(rowVariationType)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{product.slug}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-400">
                    {rowVariationType === "none"
                      ? "No color or size selectors"
                      : rowVariationType === "color"
                        ? "Color selector only"
                        : rowVariationType === "size"
                          ? "Size selector only"
                          : "Color + size selectors"}
                  </td>
                  <td className="px-3 py-3">{formatCurrency(product.price)}</td>
                  <td className="px-3 py-3">{product.category}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${product.active ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}
                    >
                      {product.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-200"
                        onClick={() =>
                          setDraft({
                            ...product,
                            id: product.id,
                            variationType: rowVariationType,
                            colors: (product.colors || []).map((color) => ({
                              ...color,
                              images: normalizeColorImages(color.images),
                              variants: color.variants?.length
                                ? color.variants
                                : [{ size: null, stock: 0 }],
                            })),
                            sizes: (product.sizes || []).map((size) => ({
                              id: size.id,
                              name: size.name,
                              enabled: true,
                              stock: size.stock ?? 0,
                            })),
                            gallery: product.gallery || [],
                            stock: product.stock ?? "",
                          })
                        }
                      >
                        Edit
                      </button>
                      {!product.active ? (
                        <button
                          type="button"
                          className="rounded-full border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300"
                          onClick={() => restoreProduct(product.id)}
                        >
                          Restore
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-full border border-rose-500/20 px-3 py-1.5 text-xs text-rose-300"
                        onClick={() => removeProduct(product.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function InventoryView() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [notice, setNotice] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const payload = await apiFetch("/api/inventory");
      if (requestSeq.current !== seq) return;
      setInventory(payload.data || []);
      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      if (requestSeq.current !== seq) return;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const updateStock = async (rowId, nextStock) => {
    // Invalidate any in-flight refresh so it cannot overwrite the save.
    requestSeq.current += 1;
    const stock = Math.max(0, Number(nextStock) || 0);
    setInventory((current) =>
      current.map((group) => ({
        ...group,
        colors: group.colors.map((color) => ({
          ...color,
          rows: color.rows.map((row) =>
            row.id === rowId ? { ...row, stock } : row,
          ),
        })),
      })),
    );
    setSavingId(rowId);
    try {
      await apiFetch(`/api/inventory/${rowId}`, {
        method: "PUT",
        body: JSON.stringify({ stock }),
      });
      setNotice("Stock updated.");
      window.setTimeout(() => setNotice(""), 2500);
    } catch (err) {
      setError(err.message);
      void load();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-slate-400">
          {error ? (
            <span className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-rose-300">
              {error}
            </span>
          ) : (
            <>
              Stock by product, color, and size • auto-refresh every 45s
              {lastUpdated ? (
                <span className="ml-2 text-slate-500">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              ) : null}
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {notice ? (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-300">
              {notice}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
          >
            ⟳ Refresh
          </button>
        </div>
      </div>

      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold text-white">Inventory matrix</h2>
        <p className="mt-1 text-sm text-slate-400">
          Track stock by product, color, and size. Changes save automatically.
        </p>
        {loading ? (
          <p className="mt-6 text-sm text-slate-400">Loading inventory…</p>
        ) : inventory.length === 0 ? (
          <p className="mt-6 text-sm text-slate-400">
            No inventory rows yet. Create products to populate stock.
          </p>
        ) : (
          <div className="mt-6 grid gap-4">
            {inventory.map((group) => (
              <div
                key={group.productId}
                className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">
                        {group.productName}
                      </p>
                      {group.variationType ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${variationBadge(group.variationType)}`}
                        >
                          {variationLabel(group.variationType)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-400">
                      {group.category || "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {group.colors.map((color) => (
                    <div
                      key={color.colorId ?? "simple"}
                      className="rounded-2xl border border-white/10 bg-slate-900/70 p-3"
                    >
                      <div className="flex items-center gap-3">
                        {color.hex ? (
                          <span
                            className="h-3.5 w-3.5 rounded-full"
                            style={{ backgroundColor: color.hex }}
                          />
                        ) : null}
                        <p className="font-medium text-white">
                          {color.colorName || "—"}
                        </p>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {color.rows.map((row) => (
                          <label
                            key={row.id}
                            className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-300"
                          >
                            <div className="flex items-center justify-between">
                              <span>
                                {row.size ? `Size ${row.size}` : "Total stock"}
                              </span>
                              {savingId === row.id ? (
                                <span className="text-xs text-amber-300">
                                  Saving…
                                </span>
                              ) : row.stock <= 2 ? (
                                <span className="text-xs font-medium text-amber-300">
                                  Low stock
                                </span>
                              ) : (
                                <span
                                  className={`text-xs ${row.stock === 0 ? "text-rose-300" : "text-emerald-300"}`}
                                >
                                  {row.stock === 0
                                    ? "Unavailable"
                                    : "In stock"}
                                </span>
                              )}
                            </div>
                            <StockInput
                              key={`${row.id}-${row.stock}`}
                              row={row}
                              onSave={updateStock}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StockInput({ row, onSave }) {
  const [value, setValue] = useState(row.stock);

  const commit = () => {
    const next = Math.max(0, Number(value) || 0);
    if (next !== row.stock) {
      onSave(row.id, next);
    } else {
      setValue(row.stock);
    }
  };

  return (
    <input
      type="number"
      min="0"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.target.blur();
      }}
      className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-white outline-none focus:border-amber-500/50"
    />
  );
}

function OrdersView() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [notice, setNotice] = useState("");
  const requestSeq = useRef(0);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (dateFilter) params.set("date", dateFilter);
      const payload = await apiFetch(`/api/orders?${params.toString()}`);
      if (requestSeq.current !== seq) return;
      setOrders(payload.data?.orders || []);
      setTotal(payload.data?.total || 0);
      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      if (requestSeq.current !== seq) return;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, dateFilter]);

  useEffect(() => {
    window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const changeStatus = async (orderId, nextStatus) => {
    // Invalidate any in-flight list refresh so it cannot overwrite the save.
    requestSeq.current += 1;
    setUpdatingId(orderId);
    try {
      const payload = await apiFetch(`/api/orders/${orderId}`, {
        method: "PUT",
        body: JSON.stringify({ status: nextStatus }),
      });
      const saved = payload.data;
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId ? { ...order, status: saved.status } : order,
        ),
      );
      setSelected((current) =>
        current && current.id === orderId
          ? { ...current, status: saved.status }
          : current,
      );
      setNotice("Order status saved.");
      window.setTimeout(() => setNotice(""), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-slate-400">
          {error ? (
            <span className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-rose-300">
              {error}
            </span>
          ) : (
            <>
              {total} order(s) • auto-refresh every 45s
              {lastUpdated ? (
                <span className="ml-2 text-slate-500">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              ) : null}
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {notice ? (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-300">
              {notice}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
          >
            ⟳ Refresh
          </button>
        </div>
      </div>

      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Orders</h2>
            <p className="mt-1 text-sm text-slate-400">
              Review purchases and update fulfillment status in seconds.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search order number, customer, phone, email…"
            className="rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white"
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(event) => {
              setDateFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white"
          />
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Order</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Phone</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Total</th>
                <th className="px-3 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    className="px-3 py-8 text-center text-slate-400"
                    colSpan={6}
                  >
                    Loading orders…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-8 text-center text-slate-400"
                    colSpan={6}
                  >
                    No orders match your filters.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                <tr
                  key={order.id}
                  className="cursor-pointer border-t border-white/10 transition hover:bg-white/5"
                  onClick={() => setSelected(order)}
                >
                  <td className="px-3 py-3 font-semibold text-white">
                    {order.orderNumber || order.id}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-100">
                      {order.customerName || "—"}
                    </p>
                    {order.email ? (
                      <p className="text-xs text-slate-500">{order.email}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">{order.phone || "—"}</td>
                  <td className="px-3 py-3">
                    <select
                      value={order.status || ""}
                      disabled={updatingId === order.id}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        changeStatus(order.id, event.target.value)
                      }
                      className={`rounded-xl border border-slate-700 bg-slate-950/80 px-2 py-2 text-sm ${statusStyle(order.status)}`}
                    >
                      {ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 font-medium text-white">
                    {formatCurrency(order.total)}
                  </td>
                  <td className="px-3 py-3">{formatDate(order.createdAt)}</td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-4 sm:flex-row">
          <p className="text-sm text-slate-400">
            Page {page} of {totalPages} • {total} order(s)
          </p>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-xl border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-sm text-white"
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-xl border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              className="rounded-xl border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selected ? (
        <OrderDetailDrawer
          order={selected}
          updatingId={updatingId}
          onClose={() => setSelected(null)}
          onChangeStatus={changeStatus}
        />
      ) : null}
    </div>
  );
}

function OrderDetailDrawer({ order, updatingId, onChangeStatus, onClose }) {
  const lineTotal = (item) => (item.price || 0) * (item.quantity || 0);
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">
              Order {order.orderNumber || order.id}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Placed {formatDate(order.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/5"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-6 p-6">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <div>
              <p className="text-sm text-slate-400">Status</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {statusLabel(order.status)}
              </p>
            </div>
            <select
              value={order.status || ""}
              disabled={updatingId === order.id}
              onChange={(event) => onChangeStatus(order.id, event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-white"
            >
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </div>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
              Customer details
            </h3>
            <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm">
              <p className="font-medium text-white">
                {order.customerName || "—"}
              </p>
              <p className="text-slate-300">
                {order.phone ? (
                  <a
                    href={`tel:${order.phone}`}
                    className="text-amber-300 hover:underline"
                  >
                    {order.phone}
                  </a>
                ) : (
                  "—"
                )}
              </p>
              <p className="text-slate-300">
                {order.email ? (
                  <a
                    href={`mailto:${order.email}`}
                    className="text-amber-300 hover:underline"
                  >
                    {order.email}
                  </a>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
              Shipping location
            </h3>
            <p className="mt-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-200">
              {order.location || "No delivery location recorded."}
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
              Products ({order.items?.length || 0})
            </h3>
            <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
              <table className="min-w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/80 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5">Product</th>
                    <th className="px-3 py-2.5">Color</th>
                    <th className="px-3 py-2.5">Size</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.length ? (
                    order.items.map((item) => (
                      <tr key={item.id} className="border-t border-white/10">
                        <td className="px-3 py-2.5 font-medium text-white">
                          {item.productName}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-2">
                            {item.colorHex ? (
                              <span
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: item.colorHex }}
                              />
                            ) : null}
                            {item.colorName || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">{item.size || "—"}</td>
                        <td className="px-3 py-2.5 text-right">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-white">
                          {formatCurrency(lineTotal(item))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-4 text-center text-slate-500"
                      >
                        No items recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Delivery</span>
                <span>{formatCurrency(order.deliveryFee || 0)}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2 text-base font-semibold text-white">
                <span>Total</span>
                <span>{formatCurrency(order.total || 0)}</span>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function CollectionsView({ state, updateState }) {
  const [draft, setDraft] = useState({
    name: "",
    slug: "",
    description: "",
    featured: false,
    productIds: [],
  });

  const saveCollection = (event) => {
    event.preventDefault();
    updateState((current) => ({
      ...current,
      collections: [
        ...current.collections,
        { id: `col-${Date.now()}`, ...draft, productIds: draft.productIds },
      ],
    }));
    setDraft({
      name: "",
      slug: "",
      description: "",
      featured: false,
      productIds: [],
    });
  };

  const toggleProduct = (productId) => {
    setDraft((current) => ({
      ...current,
      productIds: current.productIds.includes(productId)
        ? current.productIds.filter((id) => id !== productId)
        : [...current.productIds, productId],
    }));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold text-white">Collections</h2>
        <p className="mt-1 text-sm text-slate-400">
          Group products into featured and evergreen bundles.
        </p>
        <form
          onSubmit={saveCollection}
          className="mt-6 grid gap-4 lg:grid-cols-2"
        >
          <label className="text-sm font-medium text-slate-200">
            Name
            <input
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-white"
              required
            />
          </label>
          <label className="text-sm font-medium text-slate-200">
            Slug
            <input
              value={draft.slug}
              onChange={(event) =>
                setDraft({ ...draft, slug: event.target.value })
              }
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-white"
              required
            />
          </label>
          <label className="text-sm font-medium text-slate-200 lg:col-span-2">
            Description
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-white"
              required
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300 lg:col-span-2">
            <input
              type="checkbox"
              checked={draft.featured}
              onChange={(event) =>
                setDraft({ ...draft, featured: event.target.checked })
              }
            />
            Featured collection
          </label>
          <div className="lg:col-span-2">
            <p className="text-sm font-medium text-slate-200">
              Assign products
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {state.products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => toggleProduct(product.id)}
                  className={`rounded-full px-3 py-2 text-sm ${draft.productIds.includes(product.id) ? "bg-amber-500 text-slate-950" : "border border-slate-700 text-slate-300"}`}
                >
                  {product.name}
                </button>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2">
            <button
              type="submit"
              className="rounded-2xl bg-amber-500 px-4 py-3 font-semibold text-slate-950"
            >
              Create collection
            </button>
          </div>
        </form>
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        {state.collections.map((collection) => (
          <div
            key={collection.id}
            className="rounded-3xl border border-white/10 bg-slate-900/70 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {collection.name}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {collection.description}
                </p>
              </div>
              {collection.featured ? (
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-300">
                  Featured
                </span>
              ) : null}
            </div>
            <p className="mt-4 text-sm text-slate-300">
              Assigned products: {collection.productIds.length}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}

function CustomersView() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const requestSeq = useRef(0);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);
      const payload = await apiFetch(`/api/customers?${params.toString()}`);
      if (requestSeq.current !== seq) return;
      setCustomers(payload.data?.customers || []);
      setTotal(payload.data?.total || 0);
      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      if (requestSeq.current !== seq) return;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const openCustomer = async (customer) => {
    setSelected(customer);
    setDetail(null);
    setDetailLoading(true);
    try {
      const payload = await apiFetch(`/api/customers/${customer.id}`);
      setDetail(payload.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-slate-400">
          {error ? (
            <span className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-rose-300">
              {error}
            </span>
          ) : (
            <>
              {total} customer(s) • auto-refresh every 45s
              {lastUpdated ? (
                <span className="ml-2 text-slate-500">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              ) : null}
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
        >
          ⟳ Refresh
        </button>
      </div>

      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Customers</h2>
            <p className="mt-1 text-sm text-slate-400">
              Track supporters, purchasing history, and lifetime spend.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, phone, or email…"
            className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
          />
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Phone</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Orders</th>
                <th className="px-3 py-3">Lifetime spend</th>
                <th className="px-3 py-3">Last order</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    className="px-3 py-8 text-center text-slate-400"
                    colSpan={6}
                  >
                    Loading customers…
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-8 text-center text-slate-400"
                    colSpan={6}
                  >
                    No customers match your search.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="cursor-pointer border-t border-white/10 transition hover:bg-white/5"
                  onClick={() => void openCustomer(customer)}
                >
                  <td className="px-3 py-3 font-semibold text-white">
                    {customer.name || "—"}
                  </td>
                  <td className="px-3 py-3">{customer.phone || "—"}</td>
                  <td className="px-3 py-3">{customer.email || "—"}</td>
                  <td className="px-3 py-3">{customer.totalOrders}</td>
                  <td className="px-3 py-3 font-medium text-white">
                    {formatCurrency(customer.lifetimeSpend)}
                  </td>
                  <td className="px-3 py-3">
                    {formatDay(customer.lastOrderAt)}
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-4 sm:flex-row">
          <p className="text-sm text-slate-400">
            Page {page} of {totalPages} • {total} customer(s)
          </p>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-xl border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-sm text-white"
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-xl border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              className="rounded-xl border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selected ? (
        <CustomerDetailDrawer
          customer={selected}
          detail={detail}
          loading={detailLoading}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function CustomerDetailDrawer({ customer, detail, loading, onClose }) {
  const stats = detail?.stats;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">
              Customer
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              {customer.name || "—"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {customer.phone || "—"}
              {customer.email ? ` • ${customer.email}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/5"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-6 p-6">
          {loading ? (
            <p className="text-sm text-slate-400">
              Loading customer details…
            </p>
          ) : detail ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label="Total spend"
                  value={formatCurrency(stats?.totalSpend || 0)}
                />
                <MetricCard
                  label="Average order"
                  value={formatCurrency(stats?.averageOrderValue || 0)}
                />
                <MetricCard
                  label="Orders"
                  value={stats?.orderCount || 0}
                />
              </div>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Order history
                </h3>
                <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
                  <table className="min-w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-900/80 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">Order</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Total</th>
                        <th className="px-3 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.orders.length ? (
                        detail.orders.map((order) => (
                          <tr
                            key={order.id}
                            className="border-t border-white/10"
                          >
                            <td className="px-3 py-2.5 font-medium text-white">
                              {order.orderNumber || order.id}
                            </td>
                            <td className="px-3 py-2.5">
                              {formatDay(order.createdAt)}
                            </td>
                            <td className="px-3 py-2.5">
                              {formatCurrency(order.total)}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs ${statusStyle(order.status)}`}
                              >
                                {statusLabel(order.status)}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-4 text-center text-slate-500"
                          >
                            No orders yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Recent purchases
                </h3>
                <div className="mt-3 space-y-2">
                  {detail.recentPurchases.length ? (
                    detail.recentPurchases.map((item) => (
                      <div
                        key={item.productId}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium text-white">
                            {item.productName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.colorName ? `${item.colorName} • ` : ""}
                            Size {item.size || "—"} • Qty {item.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-white">
                            {formatCurrency(item.price)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDay(item.purchasedAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">
                      No purchases recorded.
                    </p>
                  )}
                </div>
              </section>
            </>
          ) : (
            <p className="text-sm text-slate-400">
              Could not load customer details.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function SubscribersView() {
  const [subscribers, setSubscribers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const requestSeq = useRef(0);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);
      const payload = await apiFetch(`/api/subscribers?${params.toString()}`);
      if (requestSeq.current !== seq) return;
      setSubscribers(payload.data?.subscribers || []);
      setTotal(payload.data?.total || 0);
      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      if (requestSeq.current !== seq) return;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const exportCsv = async () => {
    try {
      const token = localStorage.getItem("mambo-admin-token") || "";
      const params = new URLSearchParams({ export: "csv" });
      if (search) params.set("search", search);
      const response = await fetch(`/api/subscribers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Unable to export subscribers.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "subscribers.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice("Exported subscribers.csv.");
      window.setTimeout(() => setNotice(""), 2500);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteSubscriber = async (id) => {
    // Invalidate any in-flight auto-refresh so a stale response fetched
    // before the delete cannot re-add the removed subscriber.
    requestSeq.current += 1;
    setDeletingId(id);
    try {
      await apiFetch(`/api/subscribers/${id}`, { method: "DELETE" });
      setSubscribers((current) => current.filter((row) => row.id !== id));
      setTotal((current) => Math.max(0, current - 1));
      setPendingDelete(null);
      setNotice("Subscriber removed.");
      window.setTimeout(() => setNotice(""), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-slate-400">
          {error ? (
            <span className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-rose-300">
              {error}
            </span>
          ) : (
            <>
              {total} VIP subscriber(s) • auto-refresh every 45s
              {lastUpdated ? (
                <span className="ml-2 text-slate-500">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              ) : null}
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {notice ? (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-300">
              {notice}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void exportCsv()}
            className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 px-4 py-2 text-sm text-amber-300 transition hover:bg-amber-500/10"
          >
            ⭳ Export CSV
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
          >
            ⟳ Refresh
          </button>
        </div>
      </div>

      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Subscribers</h2>
            <p className="mt-1 text-sm text-slate-400">
              Phone numbers collected by the storefront VIP popup. The popup is
              rate-limited to 5 sign-ups per IP per hour.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search phone number…"
            className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
          />
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Phone Number</th>
                <th className="px-3 py-3">Date Joined</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    className="px-3 py-8 text-center text-slate-400"
                    colSpan={5}
                  >
                    Loading subscribers…
                  </td>
                </tr>
              ) : subscribers.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-8 text-center text-slate-400"
                    colSpan={5}
                  >
                    No subscribers match your search.
                  </td>
                </tr>
              ) : (
                subscribers.map((subscriber) => (
                  <tr
                    key={subscriber.id}
                    className="border-t border-white/10 transition hover:bg-white/5"
                  >
                    <td className="px-3 py-3 font-mono font-medium text-white">
                      {subscriber.phone}
                    </td>
                    <td className="px-3 py-3">
                      {formatDate(subscriber.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          String(subscriber.status || "active").toLowerCase() ===
                          "active"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-slate-500/15 text-slate-300"
                        }`}
                      >
                        {statusLabel(subscriber.status || "active")}
                      </span>
                    </td>
                    <td className="px-3 py-3 capitalize">
                      {subscriber.source || "website"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {pendingDelete === subscriber.id ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-xs text-rose-300">
                            Remove forever?
                          </span>
                          <button
                            type="button"
                            onClick={() => void deleteSubscriber(subscriber.id)}
                            disabled={deletingId === subscriber.id}
                            className="rounded-full bg-rose-500/20 px-3 py-1.5 text-sm font-medium text-rose-300 transition hover:bg-rose-500/30 disabled:opacity-50"
                          >
                            {deletingId === subscriber.id ? "…" : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(null)}
                            className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/5"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingDelete(subscriber.id)}
                          className="rounded-full border border-rose-500/20 px-3 py-1.5 text-sm text-rose-300 transition hover:bg-rose-500/10"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-4 sm:flex-row">
          <p className="text-sm text-slate-400">
            Page {page} of {totalPages} • {total} subscriber(s)
          </p>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-xl border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-sm text-white"
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-xl border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              className="rounded-xl border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingsView({ state, updateState }) {
  const [localSettings, setLocalSettings] = useState(state.settings);

  const saveSettings = (event) => {
    event.preventDefault();
    updateState((current) => ({ ...current, settings: localSettings }));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold text-white">Settings</h2>
        <p className="mt-1 text-sm text-slate-400">
          Configure store communications and delivery rules.
        </p>
        <form
          onSubmit={saveSettings}
          className="mt-6 grid gap-4 lg:grid-cols-2"
        >
          <label className="text-sm font-medium text-slate-200">
            WhatsApp number
            <input
              value={localSettings.whatsapp}
              onChange={(event) =>
                setLocalSettings({
                  ...localSettings,
                  whatsapp: event.target.value,
                })
              }
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-200">
            Store announcement banner
            <input
              value={localSettings.banner}
              onChange={(event) =>
                setLocalSettings({
                  ...localSettings,
                  banner: event.target.value,
                })
              }
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-200 lg:col-span-2">
            Delivery zones
            <textarea
              value={localSettings.deliveryZones.join(", ")}
              onChange={(event) =>
                setLocalSettings({
                  ...localSettings,
                  deliveryZones: event.target.value
                    .split(",")
                    .map((zone) => zone.trim())
                    .filter(Boolean),
                })
              }
              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-white"
            />
          </label>
          <label className="text-sm font-medium text-slate-200 lg:col-span-2">
            Social links
            <textarea
              value={Object.entries(localSettings.socials)
                .map(([key, value]) => `${key}: ${value}`)
                .join("\n")}
              onChange={(event) => {
                const nextEntries = event.target.value
                  .split("\n")
                  .filter(Boolean);
                const socials = {};
                nextEntries.forEach((entry) => {
                  const [key, value] = entry.split(":");
                  if (key && value) socials[key.trim()] = value.trim();
                });
                setLocalSettings({ ...localSettings, socials });
              }}
              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-sm text-white"
            />
          </label>
          <div className="lg:col-span-2">
            <button
              type="submit"
              className="rounded-2xl bg-amber-500 px-4 py-3 font-semibold text-slate-950"
            >
              Save settings
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default App;
