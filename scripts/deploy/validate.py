#!/usr/bin/env python3
"""
RagicEDP 部署驗證腳本

使用方式:
    python validate.py                    # 完整驗證
    python validate.py --check secrets    # 只驗證 Secrets
    python validate.py --check env        # 只驗證環境變數
    python validate.py --function backup-erp-incremental  # 驗證特定函數配置
    python validate.py --generate-deploy-args backup-erp-incremental  # 產生部署參數

退出碼:
    0: 驗證通過
    1: 驗證失敗
    2: 配置文件錯誤
"""

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Optional

import yaml


class Colors:
    """終端顏色"""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color


def load_config() -> dict:
    """載入配置文件"""
    config_path = Path(__file__).parent / 'config.yaml'
    if not config_path.exists():
        print(f"{Colors.RED}錯誤: 找不到配置文件 {config_path}{Colors.NC}")
        sys.exit(2)

    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def check_gcp_secret_exists(secret_name: str, project_id: str) -> bool:
    """檢查 GCP Secret 是否存在"""
    try:
        result = subprocess.run(
            ['gcloud', 'secrets', 'describe', secret_name, '--project', project_id],
            capture_output=True,
            text=True,
        )
        return result.returncode == 0
    except FileNotFoundError:
        print(f"{Colors.RED}錯誤: gcloud CLI 未安裝{Colors.NC}")
        return False


def validate_secrets(config: dict) -> tuple[bool, list[str]]:
    """
    驗證所有 Secrets

    Returns:
        (是否全部通過, 錯誤訊息列表)
    """
    errors = []
    project_id = config['gcp']['project_id']
    secrets = config.get('secrets', [])

    print(f"\n{Colors.BLUE}=== 驗證 Secrets ==={Colors.NC}")

    for secret in secrets:
        gcp_name = secret['gcp_name']
        env_name = secret['env_name']
        required = secret.get('required', True)

        exists = check_gcp_secret_exists(gcp_name, project_id)

        if exists:
            print(f"  {Colors.GREEN}✓{Colors.NC} {gcp_name} → {env_name}")
        else:
            if required:
                print(f"  {Colors.RED}✗{Colors.NC} {gcp_name} (不存在)")
                errors.append(
                    f"必要 Secret 不存在: {gcp_name}\n"
                    f"    建立命令: gcloud secrets create {gcp_name} --data-file=<file>"
                )
            else:
                print(f"  {Colors.YELLOW}⚠{Colors.NC} {gcp_name} (選填，不存在)")

    return len(errors) == 0, errors


def validate_env_file(config: dict, env_file: Path) -> tuple[bool, list[str]]:
    """驗證 .env 文件"""
    errors = []

    print(f"\n{Colors.BLUE}=== 驗證 .env 文件 ==={Colors.NC}")

    if not env_file.exists():
        print(f"  {Colors.YELLOW}⚠{Colors.NC} .env 文件不存在 (可選)")
        return True, []

    # 讀取 .env
    env_vars = {}
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key = line.split('=', 1)[0]
                env_vars[key] = True

    # 檢查 secrets 中的 env_name 是否在 .env 中
    for secret in config.get('secrets', []):
        env_name = secret['env_name']
        if env_name in env_vars:
            print(f"  {Colors.GREEN}✓{Colors.NC} {env_name} 已定義")
        else:
            if secret.get('required', True):
                print(f"  {Colors.YELLOW}⚠{Colors.NC} {env_name} 未在 .env 中定義 (將從 Secret Manager 注入)")

    return True, errors


def validate_function_config(config: dict, function_name: str) -> tuple[bool, list[str]]:
    """驗證特定函數的配置"""
    errors = []
    functions = config.get('functions', {})

    print(f"\n{Colors.BLUE}=== 驗證函數配置: {function_name} ==={Colors.NC}")

    if function_name not in functions:
        errors.append(f"函數 {function_name} 未在配置中定義")
        return False, errors

    func_config = functions[function_name]

    # 檢查函數引用的 secrets 是否都在 secrets 配置中
    defined_secrets = {s['gcp_name'] for s in config.get('secrets', [])}
    func_secrets = func_config.get('secrets', [])

    for secret_name in func_secrets:
        if secret_name in defined_secrets:
            print(f"  {Colors.GREEN}✓{Colors.NC} Secret: {secret_name}")
        else:
            print(f"  {Colors.RED}✗{Colors.NC} Secret: {secret_name} (未定義)")
            errors.append(f"函數引用的 Secret '{secret_name}' 未在 secrets 配置中定義")

    # 顯示其他配置
    print(f"  Entry Point: {func_config.get('entry_point')}")
    print(f"  Runtime: {func_config.get('runtime')}")
    print(f"  Memory: {func_config.get('memory')}")
    print(f"  Timeout: {func_config.get('timeout')}")

    return len(errors) == 0, errors


def generate_deploy_args(config: dict, function_name: str) -> Optional[str]:
    """產生 gcloud functions deploy 的參數"""
    functions = config.get('functions', {})
    if function_name not in functions:
        print(f"{Colors.RED}錯誤: 函數 {function_name} 未定義{Colors.NC}")
        return None

    func_config = functions[function_name]
    gcp = config['gcp']

    # 建立 secrets 映射
    secrets_map = {s['gcp_name']: s['env_name'] for s in config.get('secrets', [])}

    args = []
    args.append(f"--project={gcp['project_id']}")
    args.append(f"--region={gcp['region']}")
    args.append(f"--runtime={func_config['runtime']}")
    args.append(f"--entry-point={func_config['entry_point']}")
    args.append(f"--memory={func_config['memory']}")
    args.append(f"--timeout={func_config['timeout']}")
    args.append(f"--max-instances={func_config.get('max_instances', 1)}")
    args.append("--trigger-http")
    args.append("--gen2")
    args.append("--no-allow-unauthenticated")

    # 環境變數
    env_vars = []
    for env_config in config.get('env_vars', []):
        if env_config['name'] in func_config.get('env_vars', []):
            env_vars.append(f"{env_config['name']}={env_config['value']}")
    if env_vars:
        args.append(f"--set-env-vars={','.join(env_vars)}")

    # Secrets
    secret_args = []
    for secret_gcp_name in func_config.get('secrets', []):
        env_name = secrets_map.get(secret_gcp_name)
        if env_name:
            secret_args.append(f"{env_name}={secret_gcp_name}:latest")
    if secret_args:
        args.append(f"--set-secrets={','.join(secret_args)}")

    return ' \\\n    '.join(args)


def print_summary(all_passed: bool, all_errors: list[str]):
    """印出驗證摘要"""
    print(f"\n{Colors.BLUE}{'=' * 50}{Colors.NC}")

    if all_passed:
        print(f"{Colors.GREEN}✓ 所有驗證通過{Colors.NC}")
    else:
        print(f"{Colors.RED}✗ 驗證失敗{Colors.NC}")
        print(f"\n{Colors.RED}錯誤詳情:{Colors.NC}")
        for i, error in enumerate(all_errors, 1):
            print(f"  {i}. {error}")

    print(f"{Colors.BLUE}{'=' * 50}{Colors.NC}")


def main():
    parser = argparse.ArgumentParser(description='RagicEDP 部署驗證')
    parser.add_argument('--check', choices=['secrets', 'env', 'all'], default='all',
                        help='驗證類型')
    parser.add_argument('--function', type=str, help='驗證特定函數配置')
    parser.add_argument('--generate-deploy-args', type=str, metavar='FUNCTION',
                        help='產生函數部署參數')
    parser.add_argument('--project-root', type=str, help='專案根目錄')

    args = parser.parse_args()

    # 載入配置
    config = load_config()

    # 確定專案根目錄
    if args.project_root:
        project_root = Path(args.project_root)
    else:
        project_root = Path(__file__).parent.parent.parent

    # 產生部署參數模式
    if args.generate_deploy_args:
        result = generate_deploy_args(config, args.generate_deploy_args)
        if result:
            print(result)
            sys.exit(0)
        else:
            sys.exit(1)

    # 驗證模式
    all_passed = True
    all_errors = []

    if args.check in ['secrets', 'all']:
        passed, errors = validate_secrets(config)
        all_passed = all_passed and passed
        all_errors.extend(errors)

    if args.check in ['env', 'all']:
        env_file = project_root / '.env'
        passed, errors = validate_env_file(config, env_file)
        all_passed = all_passed and passed
        all_errors.extend(errors)

    if args.function:
        passed, errors = validate_function_config(config, args.function)
        all_passed = all_passed and passed
        all_errors.extend(errors)

    # 印出摘要
    print_summary(all_passed, all_errors)

    sys.exit(0 if all_passed else 1)


if __name__ == '__main__':
    main()
