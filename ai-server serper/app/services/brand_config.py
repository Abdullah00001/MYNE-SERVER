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
    },
    "hermes": {
        "official_site": None,
        "investment_models": {"birkin", "kelly", "constance", "lindy", "picotin", "bolide", "evelyne"},
        "depreciates": False,
        "knowledge_file": "hermes",
    },
    "chanel": {
        "official_site": "chanel.com",
        "investment_models": {"classic flap", "2.55", "boy bag"},
        "depreciates": False,
        "knowledge_file": "chanel",
    },
    "louis vuitton": {
        "official_site": "louisvuitton.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "louis_vuitton",
    },
    "dior": {
        "official_site": "dior.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "dior",
    },
    "gucci": {
        "official_site": "gucci.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "gucci",
    },
    "prada": {
        "official_site": "prada.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "prada",
    },
    "bottega veneta": {
        "official_site": "bottegaveneta.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "bottega_veneta",
    },
    "saint laurent": {
        "official_site": "ysl.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "saint_laurent",
    },
    "celine": {
        "official_site": "celine.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "celine",
    },
    "céline": {
        "official_site": "celine.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "celine",
    },
    "loewe": {
        "official_site": "loewe.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "loewe",
    },
    "fendi": {
        "official_site": "fendi.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "fendi",
    },
    "balenciaga": {
        "official_site": "balenciaga.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "balenciaga",
    },
    "givenchy": {
        "official_site": "givenchy.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "givenchy",
    },
    "burberry": {
        "official_site": "burberry.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "burberry",
    },
    "valentino": {
        "official_site": "valentino.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "valentino",
    },
    "miu miu": {
        "official_site": "miumiu.com",
        "investment_models": set(),
        "depreciates": True,
        "knowledge_file": "miu_miu",
    },
    "goyard": {
        "official_site": None,
        "investment_models": {"saint louis", "artois"},
        "depreciates": False,
        "knowledge_file": "goyard",
    },
    "moynat": {
        "official_site": None,
        "investment_models": set(),
        "depreciates": False,
        "knowledge_file": "moynat",
    },
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
        "knowledge_file": "unknown",
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
