#!/usr/bin/env python3
"""
Gera DASHBOARD_USER, DASHBOARD_PASS e ENCRYPTION_KEY; atualiza .env;
opcionalmente envia secrets para Workers Cloudflare via API.

Uso:
  python scripts/generate-secrets.py
  python scripts/generate-secrets.py --push
  python scripts/generate-secrets.py --push --worker blog-power
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import secrets
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
CREDS_PATH = ROOT / ".tmp" / "dashboard-credentials.txt"

WORKER_SECRETS = {
    "blog-power": ["DASHBOARD_USER", "DASHBOARD_PASS", "ENCRYPTION_KEY", "OPENROUTER_API_KEY"],
    "publisher-pipeline": [
        "ENCRYPTION_KEY",
        "OPENROUTER_API_KEY",
        "EVOLUTION_API_URL",
        "EVOLUTION_API_KEY",
        "EVOLUTION_INSTANCE",
        "EVOLUTION_GROUP_ID",
    ],
}


def parse_env(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        t = line.strip()
        if not t or t.startswith("#"):
            continue
        if "=" not in t:
            continue
        key, value = t.split("=", 1)
        out[key.strip()] = value.strip()
    return out


def write_env(path: Path, values: dict[str, str]) -> None:
    text = path.read_text(encoding="utf-8") if path.exists() else ""

    for name, value in values.items():
        line = f"{name}={value}"
        pattern = re.compile(rf"^{re.escape(name)}=.*$", re.MULTILINE)
        if pattern.search(text):
            text = pattern.sub(line, text)
        else:
            if text and not text.endswith("\n"):
                text += "\n"
            text += f"{line}\n"

    path.write_text(text, encoding="utf-8")


def generate_values(user: str | None = None) -> dict[str, str]:
    return {
        "DASHBOARD_USER": user or "p12admin",
        "DASHBOARD_PASS": secrets.token_urlsafe(24),
        "ENCRYPTION_KEY": base64.b64encode(secrets.token_bytes(32)).decode("ascii"),
    }


def cloudflare_put_secret(
    account_id: str, token: str, worker: str, name: str, value: str
) -> None:
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{account_id}"
        f"/workers/scripts/{worker}/secrets"
    )
    body = json.dumps({"name": name, "text": value, "type": "secret_text"}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="PUT",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            payload = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Cloudflare API {err.code} ({worker}/{name}): {detail}") from err

    if not payload.get("success"):
        raise RuntimeError(f"Cloudflare API falhou ({worker}/{name}): {payload}")


def push_secrets(env: dict[str, str], workers: list[str]) -> None:
    token = env.get("CLOUDFLARE_API_TOKEN", "")
    account_id = env.get("CLOUDFLARE_ACCOUNT_ID") or env.get("ID_ACCOUNT_CLOUDFLARE", "")

    if not token or not account_id:
        raise RuntimeError("Defina CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID no .env")

    # Evolution: aceitar EVOLUTION_SERVER_URL como alias
    if not env.get("EVOLUTION_API_URL") and env.get("EVOLUTION_SERVER_URL"):
        env["EVOLUTION_API_URL"] = env["EVOLUTION_SERVER_URL"]

    for worker in workers:
        names = WORKER_SECRETS.get(worker, [])
        print(f"\n--- {worker} ---")
        for name in names:
            value = env.get(name, "")
            if not value:
                print(f"Ignorado (vazio): {name}")
                continue
            cloudflare_put_secret(account_id, token, worker, name, value)
            print(f"OK: {name}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Gera e envia secrets do Publisher P12")
    parser.add_argument("--user", default="p12admin", help="Usuário do dashboard")
    parser.add_argument("--push", action="store_true", help="Envia secrets para Cloudflare")
    parser.add_argument(
        "--worker",
        action="append",
        help="Worker alvo (padrão com --push: blog-power e publisher-pipeline)",
    )
    parser.add_argument("--no-write-env", action="store_true", help="Não altera o .env")
    args = parser.parse_args()

    generated = generate_values(args.user)
    env = parse_env(ENV_PATH)
    env.update(generated)

    if not args.no_write_env:
        write_env(ENV_PATH, generated)
        if not env.get("CLOUDFLARE_ACCOUNT_ID") and env.get("ID_ACCOUNT_CLOUDFLARE"):
            write_env(ENV_PATH, {"CLOUDFLARE_ACCOUNT_ID": env["ID_ACCOUNT_CLOUDFLARE"]})

    CREDS_PATH.parent.mkdir(exist_ok=True)
    CREDS_PATH.write_text(
        "\n".join(f"{k}={v}" for k, v in generated.items()) + "\n",
        encoding="utf-8",
    )

    print("Secrets gerados e salvos em .env")
    print(f"Cópia: {CREDS_PATH}")
    print(f"DASHBOARD_USER={generated['DASHBOARD_USER']}")
    print(f"DASHBOARD_PASS={generated['DASHBOARD_PASS']}")
    print(f"ENCRYPTION_KEY={generated['ENCRYPTION_KEY']}")

    if args.push:
        workers = args.worker or ["blog-power", "publisher-pipeline"]
        env = parse_env(ENV_PATH)
        push_secrets(env, workers)
        print("\nSecrets enviados ao Cloudflare.")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as err:
        print(f"Erro: {err}", file=sys.stderr)
        raise SystemExit(1) from err
