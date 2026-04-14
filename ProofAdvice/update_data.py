import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import requests
from bs4 import BeautifulSoup
from openai import OpenAI


BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data.json"
DEFAULT_SOURCES = [
    "https://example.com/"
]
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4.1-mini")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL")


def get_source_urls() -> List[str]:
    raw_sources = os.environ.get("OFFICIAL_SOURCE_URLS") or os.environ.get("OFFICIAL_SOURCE_URL")
    if not raw_sources:
        return DEFAULT_SOURCES
    return [item.strip() for item in raw_sources.split(",") if item.strip()]


def fetch_official_text(url: str) -> str:
    response = requests.get(
        url,
        timeout=30,
        headers={
            "User-Agent": "CertiRehberUpdater/1.0 (+https://github.com/your-org/your-repo)"
        },
    )
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    text_chunks = [chunk.strip() for chunk in soup.stripped_strings if chunk.strip()]
    cleaned_text = " ".join(text_chunks)

    if not cleaned_text:
        raise ValueError(f"Kaynak bos dondu: {url}")

    return cleaned_text[:12000]


def collect_source_texts(urls: List[str]) -> str:
    combined_blocks = []
    for url in urls:
        try:
            combined_blocks.append(f"Kaynak: {url}\nMetin: {fetch_official_text(url)}")
        except Exception as exc:
            combined_blocks.append(f"Kaynak: {url}\nHata: {exc}")
    return "\n\n".join(combined_blocks)


def load_existing_data() -> Dict[str, Any]:
    with DATA_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def extract_json_object(raw_text: str) -> Dict[str, Any]:
    raw_text = raw_text.strip()
    if raw_text.startswith("```"):
        match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", raw_text, re.DOTALL)
        if match:
            raw_text = match.group(1).strip()

    return json.loads(raw_text)


def validate_updated_data(payload: Dict[str, Any]) -> None:
    if "meta" not in payload or "filters" not in payload or "certificates" not in payload:
        raise ValueError("Guncellenen veri semasi gecersiz: meta, filters ve certificates zorunludur.")

    if not isinstance(payload["certificates"], list) or not payload["certificates"]:
        raise ValueError("Guncellenen veri semasi gecersiz: certificates bos olamaz.")

    required_certificate_keys = {
        "id",
        "name",
        "category",
        "sectors",
        "employeeRequirement",
        "requiresPersonalData",
        "obligation",
        "summary",
        "issuingAuthority",
        "lastUpdated",
    }

    for certificate in payload["certificates"]:
        missing_keys = required_certificate_keys - certificate.keys()
        if missing_keys:
            raise ValueError(f"Eksik sertifika alanlari bulundu: {sorted(missing_keys)}")


def ask_llm_for_updates(source_text: str, current_data: Dict[str, Any]) -> Dict[str, Any]:
    api_key = os.environ.get("LLM_API_KEY")
    if not api_key:
        raise EnvironmentError("LLM_API_KEY environment variable tanimli degil.")

    client_kwargs: Dict[str, Any] = {"api_key": api_key}
    if LLM_BASE_URL:
        client_kwargs["base_url"] = LLM_BASE_URL

    client = OpenAI(**client_kwargs)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    prompt = f"""
Asagidaki mevcut data.json nesnesini ve resmi kaynak metinlerini karsilastir.

Amac:
- Sertifika, uyum, kapsam, ozet veya kaynak bazli aciklamalarda anlamli bir degisiklik olup olmadigini tespit etmek.
- Belirsiz veya teyitsiz bilgi uydurmamak.
- Sema disina cikmamak.

Donus kurali:
1. Degisiklik yoksa yalnizca su JSON'u dondur:
{{"changed": false}}

2. Degisiklik varsa yalnizca su formati dondur:
{{
  "changed": true,
  "data": <tam guncellenmis data.json nesnesi>
}}

Zorunlu kurallar:
- Sadece gecerli JSON dondur.
- Markdown, aciklama, kod blogu veya yorum ekleme.
- data nesnesinde mevcut genel yapilari koru: meta, stats, filters, journey, certificates, playbooks, resources, faq.
- Kaynaktan dogrulanamayan rakam veya hukuki zorunluluk uydurma.
- Degisiklik varsa meta.lastGlobalUpdate alanini {today} yap.
- Degisen certificate nesnelerinin lastUpdated alanini {today} yap.

Mevcut JSON:
{json.dumps(current_data, ensure_ascii=False, indent=2)}

Resmi kaynak metinleri:
{source_text}
""".strip()

    response = client.responses.create(
        model=LLM_MODEL,
        input=prompt,
        temperature=0
    )

    return extract_json_object(response.output_text)


def write_updated_data(updated_data: Dict[str, Any]) -> None:
    with DATA_FILE.open("w", encoding="utf-8") as file:
        json.dump(updated_data, file, ensure_ascii=False, indent=2)
        file.write("\n")


def main() -> None:
    current_data = load_existing_data()
    source_urls = get_source_urls()
    source_text = collect_source_texts(source_urls)
    llm_result = ask_llm_for_updates(source_text, current_data)

    if not llm_result.get("changed"):
        print("Anlamli bir degisiklik tespit edilmedi; data.json korunuyor.")
        return

    updated_data = llm_result.get("data")
    if not isinstance(updated_data, dict):
        raise ValueError("LLM yaniti gecersiz: 'data' nesnesi bulunamadi.")

    validate_updated_data(updated_data)
    write_updated_data(updated_data)
    print("data.json resmi kaynak ve LLM analizi ile guncellendi.")


if __name__ == "__main__":
    main()
