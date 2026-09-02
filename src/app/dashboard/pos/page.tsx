"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useTenant } from "@/lib/tenant-context";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  category?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode?: string;
}

interface Client {
  id: string;
  name: string;
  phone?: string;
}

interface Barber {
  id: string;
  name: string;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  type: "service" | "product";
}

export default function POSPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [activeTab, setActiveTab] = useState<"services" | "products">("services");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"default" | "price_asc" | "price_desc">("default");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedBarber, setSelectedBarber] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientPoints, setClientPoints] = useState(0);
  const [redeemedPoints, setRedeemedPoints] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [splitMode, setSplitMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState<Array<{ method: string; amount: string }>>([
    { method: "debit_card", amount: "" },
    { method: "cash", amount: "" },
  ]);
  const [processing, setProcessing] = useState(false);
  // "unconfirmed" = we could not get a final answer from the terminal (timeout, rate
  // limit, network). It is NOT a rejection: the machine may well have charged the
  // client. The cashier is asked to look at the terminal and confirm, so a paid sale is
  // never silently discarded (that exact bug lost a real charge once).
  const [mpPaymentStatus, setMpPaymentStatus] = useState<"idle" | "waiting" | "approved" | "rejected" | "unconfirmed">("idle");
  const [confirmUnclearCharge, setConfirmUnclearCharge] = useState<((approved: boolean) => void) | null>(null);
  const [mpPaymentIntentId, setMpPaymentIntentId] = useState("");
  const [splitChargeProgress, setSplitChargeProgress] = useState("");
  const [currentChargeAmount, setCurrentChargeAmount] = useState(0);
  const [cancelCurrentCharge, setCancelCurrentCharge] = useState<(() => void) | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [manualDiscountAmount, setManualDiscountAmount] = useState("");
  const [manualDiscountType, setManualDiscountType] = useState<"fixed" | "percent">("fixed");
  // Which terminal provider handles card charges for this tenant. Defaults to
  // "mercadopago" (existing behavior for every tenant that hasn't configured TUU),
  // set from tenant_settings.card_payment_provider — see Configuracion -> TUU.
  const [cardProvider, setCardProvider] = useState<"mercadopago" | "tuu">("mercadopago");
  const { showToast } = useToast();
  const { tenant, loading: tenantLoading } = useTenant();

  // Get tenant ID (from context or localStorage override for super_admin)
  const getActiveTenantId = () => {
    if (tenant?.id) return tenant.id;
    try {
      const stored = localStorage.getItem("tenant_override");
      if (stored) return JSON.parse(stored).tenantId;
    } catch {}
    return "";
  };

  useEffect(() => {
    if (tenantLoading) return;
    const t = getActiveTenantId();
    const params = t ? `?tenantId=${t}` : "";
    Promise.all([
      fetch(`/api/services${params}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/products${params}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/clients${params ? params + "&" : "?"}limit=5000`).then((r) => r.json()).catch(() => ({ clients: [] })),
      fetch(`/api/barberos${params}`).then((r) => r.json()).catch(() => []),
      t ? fetch(`/api/settings/tuu?tenantId=${t}`).then((r) => r.json()).catch(() => null) : Promise.resolve(null),
    ]).then(([servicesData, productsData, clientsData, barbersData, tuuSettings]) => {
      setServices(Array.isArray(servicesData) ? servicesData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setClients(Array.isArray(clientsData?.clients) ? clientsData.clients : Array.isArray(clientsData) ? clientsData : []);
      setBarbers(Array.isArray(barbersData) ? barbersData : []);
      if (tuuSettings?.card_payment_provider === "tuu") setCardProvider("tuu");
    });
  }, [tenant?.id, tenantLoading]);

  // Get unique categories from services
  const serviceCategories = Array.from(new Set(services.map((s) => s.category).filter(Boolean))) as string[];

  const filteredItems = (() => {
    let items: Array<Service | Product> = activeTab === "services"
      ? services.filter((s) => {
          const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
          const matchesCategory = categoryFilter === "all" || s.category === categoryFilter;
          return matchesSearch && matchesCategory;
        })
      : products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.includes(search)));

    if (sortBy === "price_asc") items = [...items].sort((a, b) => a.price - b.price);
    if (sortBy === "price_desc") items = [...items].sort((a, b) => b.price - a.price);
    return items;
  })();

  const addToCart = (item: Service | Product, type: "service" | "product") => {
    const existing = cart.find((c) => c.id === item.id && c.type === type);
    if (existing) {
      setCart(cart.map((c) => (c.id === item.id && c.type === type ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([...cart, { id: item.id, name: item.name, price: Number(item.price), quantity: 1, type }]);
    }
  };

  const updateQuantity = (id: string, type: string, delta: number) => {
    setCart(
      cart
        .map((c) => (c.id === id && c.type === type ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const updatePrice = (id: string, type: string, price: number) => {
    setCart(cart.map((c) => (c.id === id && c.type === type ? { ...c, price } : c)));
  };

  const removeFromCart = (id: string, type: string) => {
    setCart(cart.filter((c) => !(c.id === id && c.type === type)));
  };

  const subtotal = cart.reduce((sum, c) => sum + Number(c.price) * c.quantity, 0);
  // Tip is NOT part of the amount charged from the POS anymore. The card terminal
  // itself asks the client for a tip when they pay with debit/credit, and that tip is
  // only recorded here afterwards (informational) — never bundled into "total" or sent
  // to MercadoPago as part of the charge. See tipAmount / tip modal below.
  const total = subtotal - discount;
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipInput, setTipInput] = useState("");
  const [lastTransactionId, setLastTransactionId] = useState<string | null>(null);

  const applyCoupon = async () => {
    setCouponError("");
    if (!couponCode) return;
    try {
      const res = await fetch(`/api/cupones/validate?code=${couponCode}&amount=${subtotal}`);
      const data = await res.json();
      if (data.valid) {
        setDiscount(data.discount);
        showToast("Cupon aplicado", "success");
      } else {
        setCouponError(data.message || "Cupon invalido");
        setDiscount(0);
      }
    } catch {
      setCouponError("Error al validar cupon");
    }
  };

  const applyManualDiscount = async () => {
    setPinError("");
    const res = await fetch("/api/pos/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pinInput }),
    });
    const data = await res.json();
    if (!data.valid) {
      setPinError(data.error || "PIN incorrecto");
      return;
    }
    // Apply discount
    const amount = parseInt(manualDiscountAmount) || 0;
    if (amount <= 0) {
      setPinError("Ingresa un monto valido");
      return;
    }
    const discountValue = manualDiscountType === "percent"
      ? Math.round(subtotal * (amount / 100))
      : amount;
    setDiscount(Math.min(discountValue, subtotal));
    setCouponCode("");
    setShowPinModal(false);
    setPinInput("");
    setManualDiscountAmount("");
    showToast(`Descuento autorizado por ${data.adminName}`, "success");
  };

  // Charge a single amount on the card terminal and wait for the result.
  // Used for a normal card payment AND for each card portion of a split payment
  // (a physical terminal can only charge one amount at a time).
  // Dispatches to MercadoPago or TUU depending on cardProvider (tenant setting) —
  // the rest of the app (handleCheckout, the payment modal) doesn't need to know
  // which provider is active, it just awaits true/false like before.
  const chargeCardAmount = (amount: number, description: string, cardMethod: "debit_card" | "credit_card" = "debit_card"): Promise<boolean> => {
    setMpPaymentStatus("waiting");
    setCurrentChargeAmount(amount);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        setCancelCurrentCharge(null);
        resolve(ok);
      };
      (async () => {
        try {
          // Determine cart type for multi-terminal routing
          const hasServices = cart.some((c) => c.type === "service");
          const hasProducts = cart.some((c) => c.type === "product");
          const cartType = hasServices && hasProducts ? "mixed" : hasServices ? "services" : "products";

          const createUrl = cardProvider === "tuu" ? "/api/tuu" : "/api/mercadopago";
          const statusUrl = cardProvider === "tuu" ? "/api/tuu/status" : "/api/mercadopago/status";
          const cancelUrl = cardProvider === "tuu" ? "/api/tuu/cancel" : "/api/mercadopago/cancel";

          const chargeRes = await fetch(createUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              barberId: selectedBarber,
              amount,
              description: description || cart.map((c) => c.name).join(", ").slice(0, 50) || "Venta re-booking",
              externalReference: `pos-${Date.now()}`,
              cartType,
              cardMethod, // only used by TUU (paymentMethod: credito/debito); ignored by MP
            }),
          });
          const chargeData = await chargeRes.json();

          if (!chargeRes.ok || !chargeData.paymentIntentId) {
            showToast(chargeData.error || "Error al iniciar el cobro", "error");
            setMpPaymentStatus("rejected");
            setTimeout(() => setMpPaymentStatus("idle"), 3000);
            finish(false);
            return;
          }

          setMpPaymentIntentId(chargeData.paymentIntentId);

          // TUU documents a request quota (~1 per minute per terminal, error 429), so
          // polling it as fast as MercadoPago just produces rate-limit errors.
          const pollEveryMs = cardProvider === "tuu" ? 6000 : 3000;

          const checkStatus = async (): Promise<string> => {
            try {
              const statusRes = await fetch(`${statusUrl}?id=${chargeData.paymentIntentId}&barberId=${selectedBarber}`);
              const statusData = await statusRes.json();
              return statusData?.status || "unknown";
            } catch {
              return "unknown";
            }
          };

          const pollInterval = setInterval(async () => {
            const status = await checkStatus();

            if (status === "approved") {
              clearInterval(pollInterval);
              clearTimeout(timeoutHandle);
              setMpPaymentStatus("approved");
              setTimeout(() => setMpPaymentStatus("idle"), 1200);
              finish(true);
            } else if (status === "cancelled" || status === "rejected") {
              // Only an explicit rejection/cancellation from the provider ends the sale.
              clearInterval(pollInterval);
              clearTimeout(timeoutHandle);
              setMpPaymentStatus("rejected");
              setTimeout(() => setMpPaymentStatus("idle"), 3000);
              finish(false);
            }
            // "pending" | "rate_limited" | "unknown" => keep waiting, never fail here.
          }, pollEveryMs);

          // Time's up. This does NOT mean the payment failed — we simply have no
          // answer. Do one last check, and if it's still unclear, ask the cashier to
          // read the terminal instead of throwing away a possibly-charged sale.
          const timeoutHandle = setTimeout(async () => {
            clearInterval(pollInterval);

            const finalStatus = await checkStatus();
            if (finalStatus === "approved") {
              setMpPaymentStatus("approved");
              setTimeout(() => setMpPaymentStatus("idle"), 1200);
              finish(true);
              return;
            }
            if (finalStatus === "cancelled" || finalStatus === "rejected") {
              setMpPaymentStatus("rejected");
              setTimeout(() => setMpPaymentStatus("idle"), 3000);
              finish(false);
              return;
            }

            setMpPaymentStatus("unconfirmed");
            setConfirmUnclearCharge(() => (approved: boolean) => {
              setConfirmUnclearCharge(null);
              setMpPaymentStatus(approved ? "approved" : "idle");
              if (approved) setTimeout(() => setMpPaymentStatus("idle"), 1200);
              finish(approved);
            });
          }, 120000);

          // Let the user cancel this specific charge (used by the modal's Cancel button).
          // NOTE: for TUU this only stops OUR polling — TUU's public API has no
          // documented way to cancel a request already sent to the terminal, so the
          // physical POS may keep waiting for a card until cancelled on the machine.
          setCancelCurrentCharge(() => () => {
            clearInterval(pollInterval);
            clearTimeout(timeoutHandle);
            fetch(cancelUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cardProvider === "tuu" ? { idempotencyKey: chargeData.paymentIntentId } : { orderId: chargeData.paymentIntentId }),
            });
            if (cardProvider === "tuu") showToast("Si la maquina TUU sigue esperando la tarjeta, cancelalo tambien ahi", "info");
            setMpPaymentStatus("idle");
            setMpPaymentIntentId("");
            finish(false);
          });
        } catch (err) {
          setMpPaymentStatus("rejected");
          setTimeout(() => setMpPaymentStatus("idle"), 3000);
          finish(false);
        }
      })();
    });
  };

  const handleCheckout = async () => {
    // Validate based on mode
    if (!selectedBarber || cart.length === 0) return;

    if (splitMode) {
      const splitTotal = splitPayments.reduce((s, p) => s + (parseInt(p.amount) || 0), 0);
      if (splitTotal !== total) return;

      // Charge every card portion (debit or credit) on the MP terminal, one at a time.
      // This was the missing piece: a split payment never touched the terminal at all,
      // so a debit portion in a split never activated the machine.
      const cardSplits = splitPayments
        .map((p, idx) => ({ ...p, idx }))
        .filter((p) => (p.method === "debit_card" || p.method === "credit_card") && parseInt(p.amount) > 0);

      for (let i = 0; i < cardSplits.length; i++) {
        const sp = cardSplits[i];
        const amount = parseInt(sp.amount);
        const methodLabel = sp.method === "debit_card" ? "Debito" : "Credito";
        setSplitChargeProgress(`Cobrando ${methodLabel} ${formatCurrency(amount)} (${i + 1} de ${cardSplits.length})`);

        const approved = await chargeCardAmount(amount, `${methodLabel} - pago dividido`, sp.method as "debit_card" | "credit_card");
        if (!approved) {
          setSplitChargeProgress("");
          return; // Abort: don't record the sale, cashier can retry the failed portion
        }
      }
      setSplitChargeProgress("");
      await processCheckout();
      return;
    }

    if (!paymentMethod) return;

    const isCardPayment = paymentMethod === "debit_card" || paymentMethod === "credit_card";

    if (isCardPayment) {
      const approved = await chargeCardAmount(total, cart.map((c) => c.name).join(", ").slice(0, 50), paymentMethod as "debit_card" | "credit_card");
      if (approved) await processCheckout();
      return;
    }

    // Non-card payments: process immediately
    await processCheckout();
  };

  const processCheckout = async () => {
    setProcessing(true);
    try {
      const payments = splitMode
        ? splitPayments.filter((p) => parseInt(p.amount) > 0).map((p) => ({ method: p.method, amount: parseInt(p.amount) }))
        : undefined;

      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberId: selectedBarber,
          clientId: selectedClient || null,
          items: cart,
          paymentMethod: splitMode ? "mixed" : paymentMethod,
          payments,
          couponCode: couponCode || null,
          discount,
          subtotal,
          total,
          redeemedPoints: redeemedPoints || 0,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        // Was any part of this sale paid by card? The terminal asks for a tip itself
        // when that happens, so we ask the cashier to record it afterwards — we never
        // charge the tip ourselves, only log what the client added on the machine.
        const hadCardPayment = splitMode
          ? splitPayments.some((p) => (p.method === "debit_card" || p.method === "credit_card") && parseInt(p.amount) > 0)
          : (paymentMethod === "debit_card" || paymentMethod === "credit_card");

        setCart([]);
        setDiscount(0);
        setCouponCode("");
        setPaymentMethod("");
        setSplitMode(false);
        setSplitPayments([{ method: "debit_card", amount: "" }, { method: "cash", amount: "" }]);
        setSelectedClient("");
        setClientPoints(0);
        setRedeemedPoints(0);
        setMpPaymentStatus("idle");
        setMpPaymentIntentId("");
        setSplitChargeProgress("");
        setSuccessAmount(total);

        if (hadCardPayment && result.transactionId) {
          setLastTransactionId(result.transactionId);
          setTipInput("");
          setShowTipModal(true);
        } else {
          setShowSuccessModal(true);
          setTimeout(() => setShowSuccessModal(false), 4000);
        }
      }
    } catch (err) {
      console.error("Error en checkout:", err);
    } finally {
      setProcessing(false);
    }
  };

  const recordTip = async (amount: number) => {
    if (lastTransactionId && amount > 0) {
      try {
        await fetch(`/api/pos/checkout/tip`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId: lastTransactionId, tipAmount: amount }),
        });
      } catch (e) {
        console.error("Error registrando propina:", e);
      }
    }
    setShowTipModal(false);
    setLastTransactionId(null);
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 4000);
  };

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-4rem)]">
      {/* Left: Items */}
      <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
        {/* Tabs with count */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab("services")}
            className={`px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${
              activeTab === "services" ? "bg-brand-blue text-white shadow-md shadow-brand-blue/20" : "bg-white border border-gray-200 text-brand-dark hover:border-brand-blue"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            Servicios ({services.length})
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${
              activeTab === "products" ? "bg-brand-blue text-white shadow-md shadow-brand-blue/20" : "bg-white border border-gray-200 text-brand-dark hover:border-brand-blue"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            Productos ({products.length})
          </button>
        </div>

        {/* Search */}
        {/* Category filter for services */}
        {activeTab === "services" && serviceCategories.length > 0 && (
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
            <button onClick={() => setCategoryFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                categoryFilter === "all" ? "bg-brand-blue text-white" : "bg-gray-100 text-brand-gray hover:bg-gray-200"
              }`}>
              Todos
            </button>
            {serviceCategories.map((cat) => (
              <button key={cat} onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  categoryFilter === cat ? "bg-brand-blue text-white" : "bg-gray-100 text-brand-gray hover:bg-gray-200"
                }`}>
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Sort by price */}
        <div className="flex gap-1.5 mb-3">
          <button onClick={() => setSortBy(sortBy === "price_asc" ? "default" : "price_asc")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              sortBy === "price_asc" ? "bg-brand-blue text-white" : "bg-gray-100 text-brand-gray hover:bg-gray-200"
            }`}>
            Precio ↑
          </button>
          <button onClick={() => setSortBy(sortBy === "price_desc" ? "default" : "price_desc")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              sortBy === "price_desc" ? "bg-brand-blue text-white" : "bg-gray-100 text-brand-gray hover:bg-gray-200"
            }`}>
            Precio ↓
          </button>
        </div>

        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar o escanear codigo de barras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && search.trim()) {
                // Barcode scanner sends Enter after scan
                const found = products.find((p) => p.barcode === search.trim());
                if (found) {
                  addToCart(found, "product");
                  setSearch("");
                  setActiveTab("products");
                }
              }
            }}
            className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none"
          />
        </div>

        {/* Product/Service grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredItems.map((item) => {
            const inCart = cart.find((c) => c.id === item.id && c.type === (activeTab === "services" ? "service" : "product"));
            return (
              <button
                key={item.id}
                onClick={() => addToCart(item, activeTab === "services" ? "service" : "product")}
                className={`relative bg-white p-4 rounded-2xl border transition-all text-left group active:scale-95 ${
                  inCart ? "border-brand-blue shadow-md shadow-brand-blue/10" : "border-gray-100 hover:border-brand-blue/50 hover:shadow-md"
                }`}
              >
                {/* Type badge */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
                  activeTab === "services" ? "bg-blue-50 text-brand-blue" : "bg-orange-50 text-orange-500"
                }`}>
                  {activeTab === "services" ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                  )}
                </div>
                <p className="font-semibold text-sm text-brand-dark truncate">{item.name}</p>
                <p className="text-brand-blue font-bold text-base mt-1">{formatCurrency(Number(item.price))}</p>
                <p className="text-[11px] text-brand-gray mt-0.5">
                  {activeTab === "services"
                    ? `${(item as Service).duration} min`
                    : `Stock: ${(item as Product).stock}`}
                </p>

                {/* Quantity badge if in cart */}
                {inCart && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-brand-blue text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md">
                    {inCart.quantity}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-full lg:w-[420px] bg-white border-t lg:border-t-0 lg:border-l flex flex-col lg:max-h-screen">
        {/* Compact header: barber + client */}
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base text-brand-dark">Venta</h2>
              {cart.length > 0 && (
                <span className="w-5 h-5 bg-brand-blue text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                  {cart.reduce((s, c) => s + c.quantity, 0)}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <span className="text-sm font-bold text-brand-blue">{formatCurrency(total)}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedBarber}
              onChange={(e) => setSelectedBarber(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
            >
              <option value="">Profesional *</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <div className="relative">
              <input
                type="text"
                placeholder="Cliente..."
                value={clientSearch}
                onChange={async (e) => {
                  const val = e.target.value;
                  setClientSearch(val);
                  setSelectedClient("");
                  // Server-side search when 2+ chars typed
                  if (val.length >= 2) {
                    const t = getActiveTenantId();
                    const searchParams = new URLSearchParams();
                    if (t) searchParams.set("tenantId", t);
                    searchParams.set("search", val);
                    searchParams.set("limit", "10");
                    const res = await fetch(`/api/clients?${searchParams.toString()}`);
                    const data = await res.json();
                    setClients(data.clients || []);
                  }
                }}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
              />
              {clientSearch.length >= 2 && !selectedClient && clients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                  {clients
                    .slice(0, 8)
                    .map((c) => (
                      <button key={c.id} onClick={async () => {
                        setSelectedClient(c.id); setClientSearch(c.name);
                        const res = await fetch(`/api/clients/${c.id}`);
                        const data = await res.json();
                        setClientPoints(data?.client?.loyalty_points || data?.loyalty_points || 0);
                      }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100">
                        {c.name} {c.phone ? `· ${c.phone}` : ""}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Loyalty points - compact */}
          {selectedClient && clientPoints > 0 && (
            <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
              <span className="text-xs text-brand-blue font-medium">{clientPoints - redeemedPoints} pts</span>
              {redeemedPoints === 0 ? (
                <button onClick={() => { const max = Math.min(clientPoints * 100, subtotal); setRedeemedPoints(Math.floor(max / 100)); setDiscount(Math.floor(max / 100) * 100); }}
                  disabled={subtotal === 0} className="text-[10px] px-2 py-1 bg-brand-blue text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                  Canjear
                </button>
              ) : (
                <button onClick={() => { setRedeemedPoints(0); setDiscount(0); }}
                  className="text-[10px] px-2 py-1 border border-red-300 text-red-500 rounded-md hover:bg-red-50">
                  Quitar (-{formatCurrency(redeemedPoints * 100)})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Cart items - scrollable, spacious */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {cart.length === 0 ? (
            <div className="text-center py-10">
              <img src="/oti/oti-face-96.png" alt="Oti pensando" className="w-20 h-20 mx-auto mb-2 opacity-90" />
              <p className="text-brand-gray text-sm font-medium">Carrito vacio</p>
              <p className="text-brand-gray text-[11px] mt-1">Toca un servicio o producto para agregar</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[11px] text-brand-gray font-medium uppercase tracking-wider">Items ({cart.reduce((s, c) => s + c.quantity, 0)})</span>
                <button onClick={() => setCart([])} className="text-[11px] text-red-400 hover:text-red-600 font-medium">Vaciar todo</button>
              </div>
              {cart.map((item) => (
                <div key={`${item.type}-${item.id}`} className="bg-white border border-gray-100 rounded-xl p-3 hover:border-brand-blue/30 transition-colors">
                  <div className="flex items-center gap-3">
                    {/* Type icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      item.type === "service" ? "bg-blue-50 text-brand-blue" : "bg-orange-50 text-orange-500"
                    }`}>
                      {item.type === "service" ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                      )}
                    </div>
                    {/* Name + price per unit */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-brand-dark truncate">{item.name}</p>
                      <p className="text-[11px] text-brand-gray">{formatCurrency(Number(item.price))} c/u</p>
                    </div>
                    {/* Line total */}
                    <p className="font-bold text-sm text-brand-dark flex-shrink-0">{formatCurrency(Number(item.price) * item.quantity)}</p>
                  </div>
                  {/* Quantity controls */}
                  <div className="flex items-center justify-between mt-2 pl-[52px]">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQuantity(item.id, item.type, -1)}
                        className="w-7 h-7 rounded-lg bg-brand-light border border-gray-200 text-brand-dark flex items-center justify-center text-base hover:border-brand-blue hover:text-brand-blue transition-colors">−</button>
                      <span className="text-sm font-bold text-brand-dark w-8 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.type, 1)}
                        className="w-7 h-7 rounded-lg bg-brand-light border border-gray-200 text-brand-dark flex items-center justify-center text-base hover:border-brand-blue hover:text-brand-blue transition-colors">+</button>
                    </div>
                    <button onClick={() => removeFromCart(item.id, item.type)}
                      className="text-[11px] text-red-400 hover:text-red-600 font-medium">
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="border-t p-4 space-y-3">
          {/* Coupon & Manual Discount */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Codigo cupon"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={applyCoupon}
                className="px-3 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900"
              >
                Aplicar
              </button>
            </div>
            <button
              onClick={() => setShowPinModal(true)}
              className="w-full py-2 border-2 border-dashed border-orange-300 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-50"
            >
              🔐 Descuento manual (PIN admin)
            </button>
            {discount > 0 && (
              <button onClick={() => setDiscount(0)} className="text-xs text-red-500 hover:underline">
                Quitar descuento
              </button>
            )}
          </div>
          {couponError && <p className="text-red-500 text-xs">{couponError}</p>}

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Descuento</span>
                <span>-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-1 border-t">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
            {/* Tip is asked on the terminal itself, after the card payment. See the
                "Cliente agrego propina?" step in the success flow below. */}
          </div>

          {/* Payment Methods */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">Metodo de pago</span>
              <button onClick={() => setSplitMode(!splitMode)}
                className={`text-[10px] px-2 py-0.5 rounded-full ${splitMode ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                {splitMode ? "Pago dividido ✓" : "Dividir pago"}
              </button>
            </div>

            {!splitMode ? (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "cash", label: "Efectivo" },
                  { key: "debit_card", label: "Debito" },
                  { key: "credit_card", label: "Credito" },
                  { key: "transfer", label: "Transfer" },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setPaymentMethod(m.key)}
                    className={`py-2 rounded-lg text-sm font-medium ${
                      paymentMethod === m.key
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {splitPayments.map((sp, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={sp.method}
                      onChange={(e) => {
                        const updated = [...splitPayments];
                        updated[i].method = e.target.value;
                        setSplitPayments(updated);
                      }}
                      className="border rounded-lg px-2 py-1.5 text-sm flex-1">
                      <option value="cash">Efectivo</option>
                      <option value="debit_card">Debito</option>
                      <option value="credit_card">Credito</option>
                      <option value="transfer">Transfer</option>
                    </select>
                    <input type="number" placeholder="$" value={sp.amount}
                      onChange={(e) => {
                        const updated = [...splitPayments];
                        updated[i].amount = e.target.value;
                        setSplitPayments(updated);
                      }}
                      className="border rounded-lg px-2 py-1.5 text-sm w-24 text-right" />
                    {splitPayments.length > 2 && (
                      <button onClick={() => setSplitPayments(splitPayments.filter((_, idx) => idx !== i))}
                        className="text-red-400 text-xs">✕</button>
                    )}
                  </div>
                ))}
                {splitPayments.length < 4 && (
                  <button onClick={() => setSplitPayments([...splitPayments, { method: "cash", amount: "" }])}
                    className="text-xs text-blue-600 hover:underline">+ Agregar metodo</button>
                )}
                {(() => {
                  const splitTotal = splitPayments.reduce((s, p) => s + (parseInt(p.amount) || 0), 0);
                  const diff = total - splitTotal;
                  return diff !== 0 ? (
                    <p className={`text-xs ${diff > 0 ? "text-red-500" : "text-orange-500"}`}>
                      {diff > 0 ? `Faltan ${formatCurrency(diff)}` : `Excede en ${formatCurrency(Math.abs(diff))}`}
                    </p>
                  ) : <p className="text-xs text-green-600 font-medium">✓ Pago cuadra</p>;
                })()}
              </div>
            )}
          </div>

          {/* MP Terminal indicator — shows for a single card payment AND for a split
              payment that includes a debit/credit portion (each portion is charged on
              the terminal, one at a time, before the sale is recorded). */}
          {selectedBarber && (
            (!splitMode && (paymentMethod === "debit_card" || paymentMethod === "credit_card")) ||
            (splitMode && splitPayments.some((p) => (p.method === "debit_card" || p.method === "credit_card") && parseInt(p.amount) > 0))
          ) && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <span className="text-blue-600 text-sm">💳</span>
              <span className="text-xs text-blue-700 flex-1">
                {splitChargeProgress || `Terminal ${cardProvider === "tuu" ? "TUU" : "MP"} se activara al cobrar`}
              </span>
              <button
                onClick={async () => {
                  await fetch(cardProvider === "tuu" ? "/api/tuu/cancel" : "/api/mercadopago/cancel", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ barberId: selectedBarber, cancelAll: true }),
                  });
                  showToast("Cola limpiada", "success");
                }}
                className="text-[10px] px-2 py-1 bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-100"
              >
                Limpiar cola
              </button>
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={
              !selectedBarber || cart.length === 0 || processing || mpPaymentStatus === "waiting" ||
              (splitMode
                ? splitPayments.reduce((s, p) => s + (parseInt(p.amount) || 0), 0) !== total
                : !paymentMethod)
            }
            className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? "Procesando..." : mpPaymentStatus === "waiting" ? "Esperando pago en maquina..." : "Cobrar"}
          </button>
        </div>
      </div>

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPinModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Autorizar Descuento</h3>
            <p className="text-sm text-gray-500 mb-4">Ingresa el PIN de administrador</p>

            <div className="space-y-3">
              {/* Discount amount */}
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder={manualDiscountType === "percent" ? "%" : "$"}
                  value={manualDiscountAmount}
                  onChange={(e) => setManualDiscountAmount(e.target.value)}
                  className="flex-1 border-2 rounded-xl px-3 py-2.5 text-sm focus:border-orange-400 outline-none"
                  autoFocus
                />
                <div className="flex bg-gray-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setManualDiscountType("fixed")}
                    className={`px-3 py-2 text-sm font-medium ${manualDiscountType === "fixed" ? "bg-orange-600 text-white" : "text-gray-600"}`}
                  >$</button>
                  <button
                    onClick={() => setManualDiscountType("percent")}
                    className={`px-3 py-2 text-sm font-medium ${manualDiscountType === "percent" ? "bg-orange-600 text-white" : "text-gray-600"}`}
                  >%</button>
                </div>
              </div>

              {/* Preview */}
              {manualDiscountAmount && (
                <p className="text-xs text-gray-500">
                  Descuento: {formatCurrency(
                    manualDiscountType === "percent"
                      ? Math.round(subtotal * (parseInt(manualDiscountAmount) || 0) / 100)
                      : parseInt(manualDiscountAmount) || 0
                  )} → Total queda en {formatCurrency(
                    subtotal - Math.min(
                      manualDiscountType === "percent"
                        ? Math.round(subtotal * (parseInt(manualDiscountAmount) || 0) / 100)
                        : parseInt(manualDiscountAmount) || 0,
                      subtotal
                    )
                  )}
                </p>
              )}

              {/* PIN input */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">PIN Admin (4 digitos)</label>
                <input
                  type="password"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "")); setPinError(""); }}
                  placeholder="••••"
                  className="w-full border-2 rounded-xl px-3 py-3 text-center text-2xl tracking-[0.5em] font-mono focus:border-orange-400 outline-none"
                  onKeyDown={(e) => { if (e.key === "Enter" && pinInput.length === 4) applyManualDiscount(); }}
                />
              </div>

              {pinError && <p className="text-red-500 text-xs text-center">{pinError}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setShowPinModal(false); setPinInput(""); setPinError(""); }}
                  className="flex-1 py-2.5 border rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                >Cancelar</button>
                <button
                  onClick={applyManualDiscount}
                  disabled={pinInput.length !== 4 || !manualDiscountAmount}
                  className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                >Autorizar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Tip modal — shown AFTER a card payment is approved, since the client adds the
          tip on the terminal itself. This is purely informational: nothing is charged
          again from here, we just record what the client added on the machine. */}
      {showTipModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="text-3xl mb-3">💳</div>
            <h3 className="text-lg font-bold text-brand-dark">Cliente agrego propina?</h3>
            <p className="text-sm text-brand-gray mt-1 mb-4">Preguntale al cliente si agrego propina en la maquina. Esto solo se registra, no se cobra de nuevo.</p>
            <div className="flex items-center justify-center gap-1 mb-3">
              {[0, 1000, 2000, 5000].map((t) => (
                <button key={t} onClick={() => setTipInput(t ? String(t) : "")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${(parseInt(tipInput) || 0) === t ? "bg-brand-blue text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {t === 0 ? "Sin propina" : `$${(t/1000).toFixed(0)}K`}
                </button>
              ))}
            </div>
            <input type="number" min="0" step="500" value={tipInput}
              onChange={(e) => setTipInput(e.target.value)}
              placeholder="Otro monto ($)"
              className="w-full border rounded-xl px-3 py-2.5 text-sm text-center mb-4" />
            <button onClick={() => recordTip(parseInt(tipInput) || 0)}
              className="w-full py-2.5 bg-brand-blue text-white rounded-xl font-medium hover:bg-brand-blue/90">
              {parseInt(tipInput) > 0 ? `Registrar propina de ${formatCurrency(parseInt(tipInput))}` : "Continuar sin propina"}
            </button>
          </div>
        </div>
      )}

      {/* Success Celebration Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSuccessModal(false)}>
          <div className="text-center animate-scale-in">
            {/* Confetti particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="absolute animate-bounce" style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 60}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  animationDuration: `${1 + Math.random()}s`,
                }}>
                  <div className={`w-3 h-3 rounded-full ${["bg-[#2EC4B6]", "bg-[#0F8B8D]", "bg-yellow-400", "bg-green-400", "bg-white"][i % 5]}`} />
                </div>
              ))}
            </div>

            {/* Main content */}
            <div className="relative">
              <img src="/oti/oti-web-320.png" alt="Venta exitosa!" className="w-28 h-28 mx-auto mb-4 drop-shadow-2xl" />
              <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm mx-auto">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-9 h-9 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-brand-dark">Venta exitosa!</h2>
                <p className="text-4xl font-black text-brand-blue mt-3">{formatCurrency(successAmount)}</p>
                <p className="text-sm text-brand-gray mt-3">Registrada correctamente</p>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-green-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Stock actualizado · Boleta enviada · Puntos acreditados
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MercadoPago Payment Modal */}
      {mpPaymentStatus !== "idle" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
            {mpPaymentStatus === "waiting" && (
              <>
                <div className="w-20 h-20 mx-auto mb-5 relative">
                  <div className="absolute inset-0 border-4 border-brand-blue/20 rounded-full" />
                  <div className="absolute inset-0 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl">💳</span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-brand-dark">Esperando pago...</h3>
                <p className="text-sm text-brand-gray mt-2">Pasa la tarjeta en la maquina Point</p>
                <p className="text-xs text-brand-gray mt-4">Monto: <strong className="text-brand-dark">{formatCurrency(currentChargeAmount || total)}</strong></p>
                {splitChargeProgress && <p className="text-xs text-blue-600 mt-1">{splitChargeProgress}</p>}
                <button onClick={() => { cancelCurrentCharge?.(); }}
                  className="mt-6 text-xs text-brand-gray hover:text-red-500">Cancelar</button>
              </>
            )}

            {mpPaymentStatus === "approved" && (
              <>
                <div className="w-20 h-20 mx-auto mb-5 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-green-700">Pago aprobado!</h3>
                <p className="text-sm text-brand-gray mt-2">Procesando venta...</p>
              </>
            )}

            {/* No final answer from the terminal (timeout / rate limit / network).
                The charge may have gone through, so ask instead of discarding it. */}
            {mpPaymentStatus === "unconfirmed" && (
              <>
                <div className="w-20 h-20 mx-auto mb-5 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-2.032-1.5-2.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-amber-700">No pudimos confirmar el pago</h3>
                <p className="text-sm text-brand-gray mt-2">
                  Revisa la pantalla de la maquina. <strong>Puede que si haya cobrado.</strong>
                </p>
                <p className="text-xs text-brand-gray mt-3">
                  Monto: <strong className="text-brand-dark">{formatCurrency(currentChargeAmount || total)}</strong>
                </p>
                <div className="mt-5 space-y-2">
                  <button
                    onClick={() => confirmUnclearCharge?.(true)}
                    className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700"
                  >
                    La maquina SI cobro — registrar venta
                  </button>
                  <button
                    onClick={() => confirmUnclearCharge?.(false)}
                    className="w-full py-2.5 border border-gray-200 text-brand-gray rounded-xl text-sm font-medium hover:bg-gray-50"
                  >
                    No cobro — no registrar
                  </button>
                </div>
              </>
            )}

            {mpPaymentStatus === "rejected" && (
              <>
                <div className="w-20 h-20 mx-auto mb-5 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-red-700">Pago rechazado</h3>
                <p className="text-sm text-brand-gray mt-2">Intenta de nuevo o usa otro metodo de pago</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
