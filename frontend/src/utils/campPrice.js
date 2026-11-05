export const formatCampPrice = (price) => Number(price) > 0
  ? new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", currencyDisplay: "code" }).format(price)
  : "Free";
