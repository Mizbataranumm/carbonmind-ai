"""Transparent food-emissions estimates backed by the project CSV dataset.

``Food_Product_Emissions.csv`` reports lifecycle factors per kilogram of food
product. It is not an image dataset and it is not a trained model. Recipes in
this module are explicit product assumptions so a confirmed dish and portion
can produce an auditable calculation.
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional


_LOCAL_DATASET = Path(__file__).resolve().parent / "Food_Product_Emissions.csv"
_PARENT_DATASET = Path(__file__).resolve().parents[1] / "Food_Product_Emissions.csv"
FOOD_EMISSIONS_DATASET = _LOCAL_DATASET if _LOCAL_DATASET.exists() else _PARENT_DATASET
FACTOR_COLUMN = "Total Global Average GHG Emissions per kg"
LIFECYCLE_STAGE_COLUMNS = {
    "land_use_change": "Land Use Change",
    "feed": "Feed",
    "farm": "Farm",
    "processing": "Processing",
    "transport": "Transport",
    "packaging": "Packaging",
    "retail": "Retail",
}


def normalise_food_key(value: str) -> str:
    """Create one stable key for user input, vision labels, and recipe aliases."""
    return "_".join(re.findall(r"[a-z0-9]+", (value or "").lower()))


@dataclass(frozen=True)
class Recipe:
    display_name: str
    default_serving_g: int
    # Ingredient masses are raw/product masses for one finished serving. They
    # need not add up to plated mass because cooking can add water or reduce it.
    ingredient_g: dict[str, float]


# These are reviewed app recipe assumptions, not values copied from the factor
# dataset. Every ingredient must exist in Food_Product_Emissions.csv.
RECIPES: dict[str, Recipe] = {
    "french_fries": Recipe("French fries", 180, {"Potatoes": 200, "Sunflower Oil": 15}),
    "chicken_biryani": Recipe(
        "Chicken biryani", 350,
        {"Rice": 100, "Poultry Meat": 100, "Milk": 25, "Other Vegetables": 100,
         "Onions & Leeks": 50, "Sunflower Oil": 15},
    ),
    "veg_biryani": Recipe(
        "Vegetable biryani", 350,
        {"Rice": 100, "Other Pulses": 45, "Peas": 35, "Other Vegetables": 140,
         "Onions & Leeks": 45, "Sunflower Oil": 15},
    ),
    "indian_thali": Recipe(
        "Indian thali", 550,
        {"Rice": 80, "Wheat & Rye": 80, "Other Pulses": 80, "Other Vegetables": 190,
         "Milk": 100, "Sunflower Oil": 15},
    ),
    "margherita_pizza": Recipe(
        "Margherita pizza", 280,
        {"Wheat & Rye": 150, "Cheese": 80, "Tomatoes": 100, "Sunflower Oil": 10},
    ),
    "chicken_pizza": Recipe(
        "Chicken pizza", 320,
        {"Wheat & Rye": 150, "Cheese": 80, "Tomatoes": 100, "Poultry Meat": 100,
         "Sunflower Oil": 10},
    ),
    "beef_burger": Recipe(
        "Beef burger", 250,
        {"Beef (beef herd)": 120, "Wheat & Rye": 80, "Cheese": 20,
         "Tomatoes": 30, "Other Vegetables": 25},
    ),
    "chicken_burger": Recipe(
        "Chicken burger", 250,
        {"Poultry Meat": 120, "Wheat & Rye": 80, "Cheese": 20,
         "Tomatoes": 30, "Other Vegetables": 25},
    ),
    "garden_salad": Recipe(
        "Garden salad", 220,
        {"Other Vegetables": 160, "Tomatoes": 80, "Olive Oil": 12},
    ),
    "tomato_pasta": Recipe(
        "Tomato pasta", 300,
        {"Wheat & Rye": 120, "Tomatoes": 150, "Olive Oil": 12, "Cheese": 15},
    ),
    "coffee": Recipe("Coffee", 250, {"Coffee": 12, "Milk": 30}),
    "rice": Recipe("Rice", 180, {"Rice": 65}),
    "potatoes": Recipe("Potatoes", 200, {"Potatoes": 200}),
    "poultry_meat": Recipe("Poultry meal", 150, {"Poultry Meat": 150}),
    "eggs": Recipe("Eggs", 100, {"Eggs": 100}),
    "tofu": Recipe("Tofu", 180, {"Tofu": 180}),
    "milk": Recipe("Milk", 250, {"Milk": 250}),
    "apples": Recipe("Apples", 182, {"Apples": 182}),
    "bananas": Recipe("Bananas", 118, {"Bananas": 118}),
    "chocolate_cookies": Recipe(
        "Chocolate sandwich cookies", 60,
        {"Wheat & Rye": 30, "Dark Chocolate": 15, "Cane Sugar": 10, "Sunflower Oil": 5},
    ),
}


# Generic dish names can conceal their main protein or preparation method, so
# bare "biryani", "pizza", "burger", "salad", and "pasta" are intentionally
# unsupported. A user must select a reviewed, specific recipe.
RECIPE_ALIASES = {
    "fries": "french_fries",
    "french_fries": "french_fries",
    "chicken_biryani": "chicken_biryani",
    "veg_biryani": "veg_biryani",
    "vegetable_biryani": "veg_biryani",
    "indian_thali": "indian_thali",
    "margherita_pizza": "margherita_pizza",
    "chicken_pizza": "chicken_pizza",
    "beef_burger": "beef_burger",
    "chicken_burger": "chicken_burger",
    "garden_salad": "garden_salad",
    "tomato_pasta": "tomato_pasta",
    "coffee": "coffee",
    "rice": "rice",
    "potato": "potatoes",
    "potatoes": "potatoes",
    "chicken": "poultry_meat",
    "poultry": "poultry_meat",
    "egg": "eggs",
    "eggs": "eggs",
    "tofu": "tofu",
    "milk": "milk",
    "apple": "apples",
    "apples": "apples",
    "banana": "bananas",
    "bananas": "bananas",
    "chocolate_sandwich_cookies": "chocolate_cookies",
    "chocolate_cookies": "chocolate_cookies",
    "chocolate_sandwich_cookie": "chocolate_cookies",
    "cookies": "chocolate_cookies",
    "cookie": "chocolate_cookies",
    "biscuit": "chocolate_cookies",
    "biscuits": "chocolate_cookies",
}


@lru_cache(maxsize=1)
def load_food_product_factors() -> dict[str, float]:
    """Read factor values from the committed Food_Product_Emissions.csv file."""
    if not FOOD_EMISSIONS_DATASET.exists():
        return {}

    with FOOD_EMISSIONS_DATASET.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if not reader.fieldnames or "Food product" not in reader.fieldnames or FACTOR_COLUMN not in reader.fieldnames:
            return {}

        factors: dict[str, float] = {}
        for row in reader:
            name = (row.get("Food product") or "").strip()
            raw_value = (row.get(FACTOR_COLUMN) or "").strip()
            if not name or not raw_value:
                continue
            try:
                value = float(raw_value)
            except ValueError:
                continue
            if value >= 0:
                factors[normalise_food_key(name)] = value
        return factors


@lru_cache(maxsize=1)
def load_food_lifecycle_factors() -> dict[str, dict[str, float]]:
    """Read the seven CSV lifecycle factors in kg CO2e per kg food produced."""
    if not FOOD_EMISSIONS_DATASET.exists():
        return {}

    with FOOD_EMISSIONS_DATASET.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        required = {"Food product", *LIFECYCLE_STAGE_COLUMNS.values()}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            return {}

        factors: dict[str, dict[str, float]] = {}
        for row in reader:
            name = (row.get("Food product") or "").strip()
            if not name:
                continue
            try:
                factors[normalise_food_key(name)] = {
                    stage: float(row[column]) for stage, column in LIFECYCLE_STAGE_COLUMNS.items()
                }
            except (TypeError, ValueError):
                continue
        return factors


def food_catalog_status() -> dict:
    """Expose factor-source readiness without presenting it as an ML metric."""
    factors = load_food_product_factors()
    return {
        "dataset_path": str(FOOD_EMISSIONS_DATASET),
        "dataset_available": bool(factors),
        "factor_count": len(factors),
        "recipe_count": len(RECIPES),
    }


def food_catalog() -> list[dict]:
    """Return only reviewed food options with CSV-derived default portions."""
    options = []
    for recipe_key, recipe in RECIPES.items():
        estimate = estimate_food_emissions(recipe_key, recipe.default_serving_g)
        if estimate is None:
            continue
        options.append({
            "value": recipe_key,
            "label": recipe.display_name,
            "default_serving_g": recipe.default_serving_g,
            "co2_kg": estimate["co2_kg"],
            "factor_source": estimate["factor_source"],
        })
    return sorted(options, key=lambda option: option["label"].lower())


def estimate_food_emissions(food_name: str, serving_g: Optional[int] = None) -> Optional[dict]:
    """Calculate an ingredient-level emissions estimate for one supported recipe."""
    normalized_name = normalise_food_key(food_name)
    recipe_key = RECIPE_ALIASES.get(normalized_name, normalized_name if normalized_name in RECIPES else None)
    recipe = RECIPES.get(recipe_key or "")
    factors = load_food_product_factors()
    lifecycle_factors = load_food_lifecycle_factors()
    if recipe is None or not factors or not lifecycle_factors:
        return None

    try:
        requested_serving = int(serving_g) if serving_g is not None else recipe.default_serving_g
    except (TypeError, ValueError):
        requested_serving = recipe.default_serving_g
    requested_serving = max(50, min(1_000, requested_serving))
    scale = requested_serving / recipe.default_serving_g

    components = []
    lifecycle_stages = {stage: 0.0 for stage in LIFECYCLE_STAGE_COLUMNS}
    for ingredient, base_mass_g in recipe.ingredient_g.items():
        factor = factors.get(normalise_food_key(ingredient))
        stage_factors = lifecycle_factors.get(normalise_food_key(ingredient))
        if factor is None or stage_factors is None:
            # Never silently replace a missing CSV factor with a hard-coded one.
            return None
        mass_g = base_mass_g * scale
        mass_kg = mass_g / 1_000
        for stage, stage_factor in stage_factors.items():
            lifecycle_stages[stage] += mass_kg * stage_factor
        components.append({
            "ingredient": ingredient,
            "ingredient_g": round(mass_g, 1),
            "factor_kg_co2e_per_kg": factor,
            "co2_kg": round(mass_kg * factor, 4),
        })

    total = round(sum(component["co2_kg"] for component in components), 3)
    reported_stage_total = round(sum(lifecycle_stages.values()), 4)
    return {
        "food_category": recipe.display_name,
        "serving_size_g": requested_serving,
        "default_serving_g": recipe.default_serving_g,
        "co2_kg": total,
        "components": components,
        "lifecycle_stages": [
            {"key": stage, "label": column, "co2_kg": round(lifecycle_stages[stage], 4)}
            for stage, column in LIFECYCLE_STAGE_COLUMNS.items()
        ],
        # The source CSV's seven explicit lifecycle columns do not always sum
        # exactly to its published global-average total. Keep that difference
        # visible rather than assigning it to an invented lifecycle stage.
        "reported_lifecycle_stage_total_co2_kg": reported_stage_total,
        "unallocated_csv_difference_co2_kg": round(total - reported_stage_total, 4),
        "method": "recipe_lca_from_food_product_emissions_csv_v1",
        "factor_source": "Food_Product_Emissions.csv",
        "portion_note": "Recipe ingredients are scaled to the displayed portion; confirm the dish and portion before logging.",
    }
