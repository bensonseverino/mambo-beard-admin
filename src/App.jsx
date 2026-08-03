import { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
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
  { to: "/inventory", label: "Inventory" },
  { to: "/collections", label: "Collections" },
  { to: "/customers", label: "Customers" },
  { to: "/settings", label: "Settings" },
];

const sizeOptions = ["XS", "S", "M", "L", "XL"];

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
            { size: "XS", stock: 4 },
            { size: "S", stock: 10 },
            { size: "M", stock: 8 },
            { size: "L", stock: 2 },
            { size: "XL", stock: 0 },
          ],
        },
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
            { size: "XS", stock: 2 },
            { size: "S", stock: 6 },
            { size: "M", stock: 7 },
            { size: "L", stock: 4 },
            { size: "XL", stock: 3 },
          ],
        },
      ],
    },
  ],
  orders: [
    {
      id: "ord-101",
      customer: "Alicia Brooks",
      status: "Processing",
      total: 118.5,
      date: "2026-08-01",
      items: 2,
    },
    {
      id: "ord-102",
      customer: "Marcus Bell",
      status: "Pending",
      total: 64,
      date: "2026-08-02",
      items: 1,
    },
    {
      id: "ord-103",
      customer: "Lina Santos",
      status: "Shipped",
      total: 142,
      date: "2026-08-03",
      items: 3,
    },
  ],
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
  customers: [
    {
      id: "cus-1",
      name: "Alicia Brooks",
      phone: "+1 555 0178",
      email: "alicia@example.com",
      totalOrders: 4,
      lifetimeSpend: 289,
    },
    {
      id: "cus-2",
      name: "Marcus Bell",
      phone: "+1 555 0141",
      email: "marcus@example.com",
      totalOrders: 2,
      lifetimeSpend: 128,
    },
  ],
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

const acceptedImageTypes = ["image/webp", "image/jpeg", "image/png"];
const maxImageSizeBytes = 20 * 1024 * 1024;
const imageTypeOptions = [
  "front",
  "back",
  "detail",
  "model",
  "lifestyle",
  "gallery",
];

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

const createColorTemplate = (index) => ({
  id: `color-${Date.now()}-${index}`,
  name: `Color ${index + 1}`,
  hex: "#111827",
  sortOrder: index + 1,
  images: [],
  variants: sizeOptions.map((size) => ({ size, stock: 0 })),
});

const getProductValidation = (product) => {
  const errors = [];
  if (!product.name?.trim()) errors.push("Add a product name.");
  if (!product.slug?.trim()) errors.push("Add a slug.");
  if (!product.price || Number(product.price) <= 0) {
    errors.push("Enter a price greater than zero.");
  }
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
    const hasInventory = color.variants?.every((variant) => {
      const stock = Number(variant.stock);
      return Number.isFinite(stock) && stock >= 0;
    });
    if (!hasInventory) {
      errors.push(`Color ${index + 1} needs inventory values for every size.`);
    }
  });
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.28),_transparent_40%),linear-gradient(135deg,#020617_0%,#111827_100%)] px-4 py-12 text-slate-100">
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

  useEffect(() => {
    localStorage.setItem("mambo-admin-state", JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (auth) {
      localStorage.setItem("mambo-admin-auth", JSON.stringify(auth));
    }
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
            <Route path="/" element={<DashboardView state={state} />} />
            <Route
              path="/products"
              element={<ProductsView state={state} updateState={updateState} />}
            />
            <Route
              path="/orders"
              element={<OrdersView state={state} updateState={updateState} />}
            />
            <Route
              path="/inventory"
              element={
                <InventoryView state={state} updateState={updateState} />
              }
            />
            <Route
              path="/collections"
              element={
                <CollectionsView state={state} updateState={updateState} />
              }
            />
            <Route
              path="/customers"
              element={<CustomersView state={state} />}
            />
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

function DashboardView({ state }) {
  const stats = useMemo(() => {
    const revenueToday = state.orders.reduce(
      (sum, order) => sum + order.total,
      0,
    );
    const totalOrders = state.orders.length;
    const lowStock = state.products.flatMap((product) =>
      product.colors.flatMap((color) =>
        color.variants
          .filter((variant) => variant.stock <= 2)
          .map((variant) => ({
            productName: product.name,
            size: variant.size,
            stock: variant.stock,
          })),
      ),
    );

    return {
      revenueToday: formatCurrency(revenueToday),
      revenueMonth: formatCurrency(revenueToday * 5),
      totalOrders,
      lowStock,
    };
  }, [state]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Revenue today" value={stats.revenueToday} />
        <MetricCard label="Revenue this month" value={stats.revenueMonth} />
        <MetricCard label="Total orders" value={stats.totalOrders} />
        <MetricCard label="Low-stock alerts" value={stats.lowStock.length} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Recent orders
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Today’s most recent purchasing activity.
              </p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {state.orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-white">{order.customer}</p>
                  <p className="text-sm text-slate-400">
                    {order.id} • {order.date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">
                    {formatCurrency(order.total)}
                  </p>
                  <p className="text-sm text-amber-300">{order.status}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">
            Low-stock products
          </h2>
          <div className="mt-6 space-y-3">
            {stats.lowStock.length ? (
              stats.lowStock.map((item, index) => (
                <div
                  key={`${item.productName}-${index}`}
                  className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3"
                >
                  <p className="font-medium text-white">{item.productName}</p>
                  <p className="text-sm text-slate-300">
                    Size {item.size} • {item.stock} units left
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
    </div>
  );
}

function ProductsView({ state, updateState }) {
  const [draft, setDraft] = useState({
    id: "",
    name: "",
    slug: "",
    description: "",
    price: "",
    category: "Care",
    featured: false,
    active: true,
    colors: [],
  });
  const [uploadQueues, setUploadQueues] = useState({});
  const [draggedImageId, setDraggedImageId] = useState(null);

  const validationMessages = useMemo(
    () => getProductValidation(draft),
    [draft],
  );
  const isPublishable = validationMessages.length === 0;

  const saveProduct = (event) => {
    event.preventDefault();
    const normalized = {
      ...draft,
      id: draft.id || `prod-${Date.now()}`,
      slug: slugifyValue(draft.slug || draft.name),
      price: Number(draft.price) || 0,
      colors: draft.colors.length
        ? draft.colors.map((color) => ({
            ...color,
            images: normalizeColorImages(color.images),
            variants: color.variants?.map((variant) => ({
              ...variant,
              stock: Number(variant.stock) || 0,
            })),
          }))
        : [createColorTemplate(0)],
    };

    updateState((current) => ({
      ...current,
      products: draft.id
        ? current.products.map((product) =>
            product.id === draft.id ? normalized : product,
          )
        : [...current.products, normalized],
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
      colors: [],
    });
  };

  const removeProduct = (productId) => {
    updateState((current) => ({
      ...current,
      products: current.products.filter((product) => product.id !== productId),
    }));
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
    setDraft((current) => ({
      ...current,
      colors: [...current.colors, createColorTemplate(current.colors.length)],
    }));
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

  const addImageToColor = async (colorId, files, imageType = "front") => {
    const color = draft.colors.find((item) => item.id === colorId);
    if (!color) return;

    const colorQueue = Array.from(files).map((file, index) => ({
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

  const uploadQueueItem = async (colorId, queueItem) => {
    const color = draft.colors.find((item) => item.id === colorId);
    if (!color) return;

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
      formData.append("colorName", color.name || "color");
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

      const uploadedImage = {
        id: `${queueItem.id}-uploaded`,
        path: payload.path,
        previewUrl: queueItem.previewUrl,
        type: queueItem.imageType,
        fileName: queueItem.fileName,
        size: queueItem.size,
        uploadedAt: new Date().toISOString(),
        isPrimary: !normalizeColorImages(color.images).length,
        sortOrder: normalizeColorImages(color.images).length + 1,
      };

      setDraft((current) => ({
        ...current,
        colors: current.colors.map((item) => {
          if (item.id !== colorId) return item;
          const nextImages = normalizeColorImages(item.images);
          return {
            ...item,
            images: [...nextImages, uploadedImage],
          };
        }),
      }));

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

  const reorderImages = (colorId, fromId, toId) => {
    setDraft((current) => ({
      ...current,
      colors: current.colors.map((color) => {
        if (color.id !== colorId) return color;
        const nextImages = normalizeColorImages(color.images);
        const fromIndex = nextImages.findIndex((image) => image.id === fromId);
        const toIndex = nextImages.findIndex((image) => image.id === toId);
        if (fromIndex < 0 || toIndex < 0) return color;
        const reordered = [...nextImages];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);
        return {
          ...color,
          images: reordered.map((image, index) => ({
            ...image,
            sortOrder: index + 1,
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
                const colorImages = normalizeColorImages(color.images);
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
                        WebP, JPG, JPEG, and PNG up to 20 MB.
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
                            {variant.stock === 0 ? "Unavailable" : "In stock"}
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
                </div>
              ))}
            </div>
          </div>

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
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-3 py-3">Product</th>
                <th className="px-3 py-3">Price</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.products.map((product) => (
                <tr key={product.id} className="border-t border-white/10">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-white">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.slug}</p>
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
                        onClick={() => setDraft(product)}
                      >
                        Edit
                      </button>
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
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function InventoryView({ state, updateState }) {
  const updateVariant = (productId, colorId, size, nextStock) => {
    updateState((current) => ({
      ...current,
      products: current.products.map((product) => {
        if (product.id !== productId) {
          return product;
        }
        return {
          ...product,
          colors: product.colors.map((color) => {
            if (color.id !== colorId) {
              return color;
            }
            return {
              ...color,
              variants: color.variants.map((variant) =>
                variant.size === size
                  ? { ...variant, stock: Number(nextStock) }
                  : variant,
              ),
            };
          }),
        };
      }),
    }));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold text-white">Inventory matrix</h2>
        <p className="mt-1 text-sm text-slate-400">
          Track stock by product, color, and size.
        </p>
        <div className="mt-6 grid gap-4">
          {state.products.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-white">{product.name}</p>
                  <p className="text-sm text-slate-400">{product.category}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {product.colors.map((color) => (
                  <div
                    key={color.id}
                    className="rounded-2xl border border-white/10 bg-slate-900/70 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3.5 w-3.5 rounded-full"
                        style={{ backgroundColor: color.hex }}
                      />
                      <div>
                        <p className="font-medium text-white">{color.name}</p>
                        <p className="text-xs text-slate-500">
                          {normalizeColorImages(color.images).length} image(s)
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {color.variants.map((variant) => (
                        <label
                          key={`${color.id}-${variant.size}`}
                          className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-300"
                        >
                          <div className="flex items-center justify-between">
                            <span>{variant.size}</span>
                            <span
                              className={`text-xs ${variant.stock === 0 ? "text-rose-300" : "text-emerald-300"}`}
                            >
                              {variant.stock === 0 ? "Unavailable" : "In stock"}
                            </span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={variant.stock}
                            onChange={(event) =>
                              updateVariant(
                                product.id,
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
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function OrdersView({ state, updateState }) {
  const updateStatus = (orderId, nextStatus) => {
    updateState((current) => ({
      ...current,
      orders: current.orders.map((order) =>
        order.id === orderId ? { ...order, status: nextStatus } : order,
      ),
    }));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Orders</h2>
            <p className="mt-1 text-sm text-slate-400">
              Review purchases and update fulfillment status in seconds.
            </p>
          </div>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Order</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Total</th>
                <th className="px-3 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {state.orders.map((order) => (
                <tr key={order.id} className="border-t border-white/10">
                  <td className="px-3 py-3 font-semibold text-white">
                    {order.id}
                  </td>
                  <td className="px-3 py-3">{order.customer}</td>
                  <td className="px-3 py-3">
                    <select
                      value={order.status}
                      onChange={(event) =>
                        updateStatus(order.id, event.target.value)
                      }
                      className="rounded-xl border border-slate-700 bg-slate-950/80 px-2 py-2 text-sm text-white"
                    >
                      {[
                        "Pending",
                        "Processing",
                        "Shipped",
                        "Delivered",
                        "Cancelled",
                      ].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">{formatCurrency(order.total)}</td>
                  <td className="px-3 py-3">{order.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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

function CustomersView({ state }) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold text-white">Customers</h2>
        <p className="mt-1 text-sm text-slate-400">
          Track supporters, purchasing history, and lifetime spend.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Phone</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Orders</th>
                <th className="px-3 py-3">Lifetime spend</th>
              </tr>
            </thead>
            <tbody>
              {state.customers.map((customer) => (
                <tr key={customer.id} className="border-t border-white/10">
                  <td className="px-3 py-3 font-semibold text-white">
                    {customer.name}
                  </td>
                  <td className="px-3 py-3">{customer.phone}</td>
                  <td className="px-3 py-3">{customer.email}</td>
                  <td className="px-3 py-3">{customer.totalOrders}</td>
                  <td className="px-3 py-3">
                    {formatCurrency(customer.lifetimeSpend)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

function MetricCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

export default App;
