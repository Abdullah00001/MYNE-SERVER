# ─────────────────────────────────────────
# CENTRALIZED BRAND CONFIGURATION
# ─────────────────────────────────────────
# To add a new brand, just add one entry here.
# No other files need to be touched.

BRAND_CONFIG = {
    "hermès": {
        "official_site": None,
        "investment_models": {"birkin", "kelly", "constance", "lindy", "picotin", "bolide", "evelyne"},
        "depreciates": False,
        "knowledge_file": "hermes",
        "min_resale_price": 8000,   # for undershoot correction in price_service
    },
    "hermes": {
        "official_site": None,
        "investment_models": {"birkin", "kelly", "constance", "lindy", "picotin", "bolide", "evelyne"},
        "depreciates": False,
        "knowledge_file": "hermes",
        "min_resale_price": 8000,   # for undershoot correction in price_service
    },
    "chanel": {
        "official_site": "chanel.com",
        "investment_models": {"classic flap", "2.55", "boy bag"},
        "depreciates": False,
        "knowledge_file": "chanel",
        "min_resale_price": 4000,   # for undershoot correction in price_service
    },
    "louis vuitton": {
        "official_site": "louisvuitton.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "louis_vuitton",
        "min_resale_price": 1800,
    },
    "dior": {
        "official_site": "dior.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "dior",
        "min_resale_price": 3000,
    },
    "gucci": {
        "official_site": "gucci.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "gucci",
        "min_resale_price": 1200,
    },
    "prada": {
        "official_site": "prada.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "prada",
        "min_resale_price": 1200,
    },
    "bottega veneta": {
        "official_site": "bottegaveneta.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "bottega_veneta",
        "min_resale_price": 2200,
    },
    "saint laurent": {
        "official_site": "ysl.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "saint_laurent",
        "min_resale_price": 1400,
    },
    "celine": {
        "official_site": "celine.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "celine",
        "min_resale_price": 1800,
    },
    "céline": {
        "official_site": "celine.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "celine",
        "min_resale_price": 1800,
    },
    "loewe": {
        "official_site": "loewe.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "loewe",
        "min_resale_price": 1800,
    },
    "fendi": {
        "official_site": "fendi.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "fendi",
        "min_resale_price": 1800,
    },
    "balenciaga": {
        "official_site": "balenciaga.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "balenciaga",
        "min_resale_price": 1000,
    },
    "givenchy": {
        "official_site": "givenchy.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "givenchy",
        "min_resale_price": 1000,
    },
    "burberry": {
        "official_site": "burberry.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "burberry",
        "min_resale_price": 800,
    },
    "valentino": {
        "official_site": "valentino.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "valentino",
        "min_resale_price": 1400,
    },
    "miu miu": {
        "official_site": "miumiu.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "miu_miu",
        "min_resale_price": 1200,
    },
    "goyard": {
        "official_site": None,
        "investment_models": {"saint louis", "artois"},
        "depreciates": False,
        "knowledge_file": "goyard",
        "min_resale_price": 3500,
    },
    "moynat": {
        "official_site": None,
        "investment_models": set(),
        "depreciates": False,
        "knowledge_file": "moynat",
        "min_resale_price": 3500,
    },
    "chloe": {
        "official_site": "chloe.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "chloe",
        "min_resale_price": 500,
    },
    "mulberry": {
        "official_site": "mulberry.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "mulberry",
        "min_resale_price": 400,
    },
    "bvlgari": {
        "official_site": "bulgari.com",
        "investment_models": {"serpenti"},
        "depreciates": True,
        "knowledge_file": "bvlgari",
        "min_resale_price": 1000,
    },
    "cartier": {
        "official_site": "cartier.com",
        "investment_models": {"panthere", "c de cartier"},
        "depreciates": False,
        "knowledge_file": "cartier",
        "min_resale_price": 1500,
    },
    "ferragamo": {
        "official_site": "ferragamo.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "ferragamo",
        "min_resale_price": 500,
    },
    "versace": {
        "official_site": "versace.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "versace",
        "min_resale_price": 800,
    },
    "dolce & gabbana": {
        "official_site": "dolcegabbana.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "dolce_gabbana",
        "min_resale_price": 600,
    },
    "coach": {
        "official_site": "coach.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "coach",
        "min_resale_price": 100,
    },
    "mcm": {
        "official_site": "mcmworldwide.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "mcm",
        "min_resale_price": 300,
    },
    "alexander mcqueen": {
        "official_site": "alexandermcqueen.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "alexander_mcqueen",
        "min_resale_price": 600,
    },
    "stella mccartney": {
        "official_site": "stellamccartney.com",
        "investment_models": {"falabella"},
        "depreciates": True,
        "knowledge_file": "stella_mccartney",
        "min_resale_price": 300,
    },
    "tom ford": {
        "official_site": "tomford.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "tom_ford",
        "min_resale_price": 800,
    },
    "christian louboutin": {
        "official_site": "christianlouboutin.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "christian_louboutin",
        "min_resale_price": 500,
    },
    "michael kors": {
        "official_site": "michaelkors.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "michael_kors",
        "min_resale_price": 100,
    },
    "tory burch": {
        "official_site": "toryburch.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "tory_burch",
        "min_resale_price": 100,
    },
    "marc jacobs": {
        "official_site": "marcjacobs.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "marc_jacobs",
        "min_resale_price": 100,
    }
}

# ─────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────


def get_brand_config(brand: str) -> dict:
    """
    Get config for a brand. Returns default config for unknown brands.
    """
    config = BRAND_CONFIG.get(brand.lower())
    if config:
        return config

    # Default for unknown brands
    return {
        "official_site": None,
        "investment_models": set(),
        "depreciates": False,   # unknown = mild multiplier
        "knowledge_file": "300",
    }


def is_investment_piece(brand: str, model: str) -> bool:
    """Returns True if this brand/model appreciates in value."""
    config = get_brand_config(brand)
    model_lower = model.lower()
    return any(m in model_lower for m in config["investment_models"])


def get_official_site(brand: str) -> str | None:
    """Returns official website or None if no public prices."""
    return get_brand_config(brand)["official_site"]


def is_depreciating(brand: str) -> bool:
    """Returns True if resale is typically below retail."""
    return get_brand_config(brand)["depreciates"]


def get_knowledge_file(brand: str) -> str:
    """Returns the knowledge file key for this brand."""
    return get_brand_config(brand)["knowledge_file"]
