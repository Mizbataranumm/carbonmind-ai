// Food CO2e estimator utility: matches reviewed catalog items or estimates custom food

export const estimateFoodItemCo2 = (name, catalog = []) => {
  if (!name || typeof name !== "string") return 0.55;
  const n = name.toLowerCase().trim();

  // 1. Check exact match in reviewed catalog
  const exact = catalog.find(
    (item) =>
      item.value?.toLowerCase() === n ||
      item.label?.toLowerCase() === n ||
      (item.name && item.name.toLowerCase() === n)
  );
  if (exact && exact.co2 != null) return exact.co2;

  // 2. Check if a catalog label contains the typed name or vice-versa
  const partial = catalog.find(
    (item) =>
      item.label?.toLowerCase().includes(n) ||
      (item.name && item.name.toLowerCase().includes(n)) ||
      n.includes(item.value?.toLowerCase() || "")
  );
  if (partial && partial.co2 != null) return partial.co2;

  // 3. Keyword-based lifecycle emission factors (kg CO2e per standard serving)
  if (n.includes("beef") || n.includes("mutton") || n.includes("lamb") || n.includes("steak")) return 3.60;
  if (n.includes("burger")) return 1.86;
  if (n.includes("pizza")) return 2.39;
  if (n.includes("chicken") || n.includes("poultry")) return 1.48;
  if (n.includes("fish") || n.includes("seafood") || n.includes("prawn") || n.includes("salmon")) return 0.85;
  if (n.includes("biryani") || n.includes("pulao")) return 1.20;
  if (n.includes("paneer") || n.includes("cheese")) return 0.90;
  if (n.includes("tofu") || n.includes("soy")) return 0.57;
  if (n.includes("egg") || n.includes("omelet")) return 0.47;
  if (n.includes("milk") || n.includes("dairy")) return 0.79;
  if (n.includes("coffee") || n.includes("latte") || n.includes("cappuccino")) return 0.44;
  if (n.includes("tea") || n.includes("chai")) return 0.05;
  if (n.includes("pasta") || n.includes("noodle") || n.includes("spaghetti")) return 0.92;
  if (n.includes("fries") || n.includes("potato")) return 0.15;
  if (n.includes("rice")) return 0.29;
  if (n.includes("bread") || n.includes("toast") || n.includes("sandwich") || n.includes("roti") || n.includes("naan")) return 0.25;
  if (n.includes("dal") || n.includes("lentil") || n.includes("sambar") || n.includes("curry") || n.includes("chole")) return 0.40;
  if (n.includes("dosa") || n.includes("idli") || n.includes("vada") || n.includes("poha") || n.includes("upma")) return 0.35;
  if (n.includes("salad") || n.includes("vegetable") || n.includes("veg") || n.includes("fruit") || n.includes("apple") || n.includes("banana")) return 0.20;
  if (n.includes("chocolate") || n.includes("dessert") || n.includes("cake") || n.includes("cookie")) return 0.80;

  return 0.55; // standard average meal footprint
};
