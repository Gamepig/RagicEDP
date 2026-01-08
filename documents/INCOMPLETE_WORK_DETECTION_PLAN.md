# 自動檢測未完成工作系統 - 實作計劃

> **建立日期**: 2025-12-26
> **狀態**: 📋 規劃完成，待執行
> **計劃文件**: `/Users/gamepig/.claude/plans/proud-juggling-brooks.md`

---

## 執行摘要

設計一個智能的未完成工作檢測系統，自動追蹤和記錄工作進度，避免遺漏待辦事項。

### 核心特性

✅ **自動檢測** - Compact 前、Session 開始時、Git commit 前自動執行
✅ **分層漸進** - 預設簡潔摘要（<500 tokens），詳細報告另存
✅ **智能推斷** - 從 Git 分支名/TodoWrite 自動推斷當前任務
✅ **無感集成** - 整合到現有 Hook 系統，無需手動操作

---

## 系統架構

```
Claude Code Hooks
    ├── PreCompact Hook      → 自動保存未完成工作
    ├── SessionStart Hook    → 自動載入上次進度
    └── Git pre-commit Hook  → 檢查待提交項目
         ↓
Detectors (檢測器集合)
    ├── GitStatusDetector    → Git 未提交變更
    ├── TodoWriteExtractor   → TodoWrite 工具待辦
    ├── StatusFileScanner    → STATUS.md 檢查清單
    ├── CodeTodoScanner      → 程式碼註解掃描
    └── TaskInferenceEngine  → 智能任務推斷
         ↓
Context Snapshot System
    └── 保存到 ~/.claude/.lra-memory/context-snapshots/
```

---

## 檢測範圍

| 類型 | 內容 | 優先級 | 檢測器 |
|------|------|--------|--------|
| **Git** | 未提交變更（modified/untracked/deleted） | P0 | GitStatusDetector |
| **TodoWrite** | 會話內待辦事項 | P0 | TodoWriteExtractor |
| **STATUS** | STATUS.md 未勾選項目 | P1 | StatusFileScanner |
| **CODE** | TODO/FIXME 程式碼註解 | P2 | CodeTodoScanner |

---

## 實作優先級

### Phase 1: P0 核心功能 (~11 小時)

**必須實作** - Compact 前自動檢測核心信息

| # | 任務 | 檔案 | 工時 | 描述 |
|----|------|------|------|------|
| 1 | GitStatusDetector | `~/.claude/scripts/detectors/git_status.py` | 2h | Git 狀態檢測 |
| 2 | TodoWriteExtractor | `~/.claude/scripts/detectors/todowrite_extractor.py` | 3h | 從 transcript 提取 TodoWrite |
| 3 | TaskInferenceEngine | `~/.claude/scripts/detectors/task_inference.py` | 1h | 智能推斷當前任務 |
| 4 | 擴展 save_context_snapshot.py | `~/.claude/scripts/save_context_snapshot.py` | 3h | 整合檢測器 |
| 5 | 擴展 load_latest_snapshot.py | `~/.claude/scripts/load_latest_snapshot.py` | 2h | 格式化摘要輸出 |

**完成後效果**：
- ✅ Compact 前自動檢測 Git 變更和 TodoWrite
- ✅ Session 開始時顯示上次未完成工作摘要
- ✅ 智能推斷當前任務（優先級）

---

### Phase 2: P1 增強功能 (~6 小時)

**建議實作** - 追蹤文件型待辦清單

| # | 任務 | 檔案 | 工時 | 描述 |
|----|------|------|------|------|
| 6 | StatusFileScanner | `~/.claude/scripts/detectors/status_scanner.py` | 2h | 掃描 STATUS.md 文件 |
| 7 | 詳細報告生成 | `~/.claude/scripts/save_context_snapshot.py` | 2h | 保存完整檢測報告 |
| 8 | 配置系統 | `~/.claude/incomplete-work-config.json` | 1h | 全域配置管理 |
| 9 | Hook 增強 | `~/.claude/scripts/context-auto-save.sh` | 1h | 增強 PreCompact Hook |

**完成後效果**：
- ✅ 追蹤 STATUS.md 文件中的檢查清單
- ✅ 詳細報告保存到獨立文件
- ✅ 配置檢測範圍和行為

---

### Phase 3: P2 高級功能 (~13 小時)

**可選實作** - 提交前檢查和程式碼掃描

| # | 任務 | 檔案 | 工時 | 描述 |
|----|------|------|------|------|
| 10 | CodeTodoScanner | `~/.claude/scripts/detectors/code_todo_scanner.py` | 4h | 掃描 TODO/FIXME 註解 |
| 11 | Git Pre-commit Hook | `~/.claude/scripts/git-hooks/pre-commit-check.sh` | 3h | Git 提交前檢查 |
| 12 | 性能優化 | 各檢測器 | 2h | 快取和優化 |
| 13 | 測試套件 | `~/.claude/scripts/tests/` | 4h | 單元和整合測試 |

**完成後效果**：
- ✅ 掃描程式碼中的 TODO/FIXME 註解
- ✅ Git commit 前提醒未完成項
- ✅ 完整的自動化工作流

---

## 關鍵文件清單

### 新建文件（Phase 1-3）

```
~/.claude/scripts/
├── detectors/                          # 新目錄
│   ├── __init__.py                    # 包初始化
│   ├── git_status.py                  # P0: Git 檢測器
│   ├── todowrite_extractor.py         # P0: TodoWrite 提取器
│   ├── task_inference.py              # P0: 任務推斷
│   ├── status_scanner.py              # P1: STATUS 掃描器
│   └── code_todo_scanner.py           # P2: 代碼掃描器
├── git-hooks/                         # P2: Git 相關
│   ├── pre-commit-check.sh
│   ├── install-hooks.sh
│   └── uninstall-hooks.sh
└── incomplete-work-config.json        # P1: 全域配置
```

### 修改文件（Phase 1-2）

```
~/.claude/scripts/
├── save_context_snapshot.py           # 擴展快照保存邏輯
├── load_latest_snapshot.py            # 擴展摘要格式輸出
└── context-auto-save.sh               # P1: 增強 Hook
```

---

## 輸出格式範例

### Session 摘要（簡潔，<500 tokens）

```markdown
# 上次 Session 進度摘要

## 📌 推斷的當前任務
**[Git Branch] Feature: Glassmorphism Redesign**

## 🔄 Git 未提交變更
- Branch: feature/glassmorphism-redesign, 3 modified, 2 untracked

## ✅ TodoWrite 待辦
- 2 in progress, 5 pending

**優先待辦**:
- [ ] 完成 Phase 4.2 遷移
- [ ] 完成 Phase 4.3 遷移

## 📋 STATUS 文件
- 37 unchecked items in LOGGING_MIGRATION_STATUS.md
```

### 詳細報告（獨立文件）

保存位置: `~/.claude/.lra-memory/context-snapshots/incomplete_work_detail_<timestamp>.md`

包含:
- Git 完整未提交列表
- TodoWrite 所有狀態
- STATUS 文件詳細內容
- 程式碼 TODO 列表

---

## 效能目標

| 檢測器 | 預估耗時 | 目標 |
|--------|---------|------|
| GitStatusDetector | 50ms | ✅ 快速 |
| TodoWriteExtractor | 100ms | ✅ 快速 |
| StatusFileScanner | 200ms | ✅ 可接受 |
| CodeTodoScanner | 2-5s | ⚠️ 默認禁用 |
| **P0 + P1 總耗時** | < 400ms | ✅ 目標 |

---

## 配置系統

### 全域配置 (~/.claude/incomplete-work-config.json)

```json
{
  "git": {
    "enabled": true,
    "ignore_deleted": true,
    "max_files_to_show": 10
  },
  "todowrite": {
    "enabled": true,
    "max_todos_to_show": 15
  },
  "status_files": {
    "enabled": true,
    "patterns": ["*STATUS*.md", "*TODO*.md", "tasks/*.md"]
  },
  "code_todos": {
    "enabled": false,
    "use_git_tracked_only": true
  }
}
```

### 專案級覆蓋 (可選)

每個專案可以在根目錄建立 `.incomplete-work-config.json` 來覆蓋全域設定。

---

## 實作策略

### Stage 1: 驗證可行性 (~11 小時)
1. 實作 P0 所有模組
2. 在 RagicEDP 測試
3. 驗證效能和準確性

### Stage 2: 增強功能 (~6 小時)
1. 根據 P0 反饋調整
2. 實作 P1 檢測器
3. 添加配置系統

### Stage 3: 生產完善 (~13 小時)
1. 根據實際使用反饋
2. 實作 P2 高級功能
3. 完整測試和文檔

---

## 成功標準

### 功能性
- ✅ Compact 前自動檢測未完成工作
- ✅ Session 開始時自動載入摘要
- ✅ 智能推斷當前任務准確率 > 80%
- ✅ 簡潔摘要 < 500 tokens
- ✅ 詳細報告完整可用

### 性能
- ✅ P0+P1 檢測耗時 < 500ms
- ✅ 不影響 Compact 速度
- ✅ 大型專案 (<10k 文件) < 1s

### 用戶體驗
- ✅ 無感自動執行
- ✅ 輸出清晰易讀
- ✅ 配置簡單直觀

---

## 待辦清單

- [ ] **Phase 1 (P0 核心功能)**
  - [ ] 1.1 GitStatusDetector (2h)
  - [ ] 1.2 TodoWriteExtractor (3h)
  - [ ] 1.3 TaskInferenceEngine (1h)
  - [ ] 1.4 擴展 save_context_snapshot.py (3h)
  - [ ] 1.5 擴展 load_latest_snapshot.py (2h)

- [ ] **Phase 2 (P1 增強功能)**
  - [ ] 2.1 StatusFileScanner (2h)
  - [ ] 2.2 詳細報告生成 (2h)
  - [ ] 2.3 配置系統 (1h)
  - [ ] 2.4 Hook 增強 (1h)

- [ ] **Phase 3 (P2 高級功能)**
  - [ ] 3.1 CodeTodoScanner (4h)
  - [ ] 3.2 Git Pre-commit Hook (3h)
  - [ ] 3.3 性能優化 (2h)
  - [ ] 3.4 測試套件 (4h)

---

## 下次會話指令

當準備開始實作時，執行以下命令：

```bash
# 檢查計劃文件
cat ~/.claude/plans/proud-juggling-brooks.md

# 查看本記錄
cat /Users/gamepig/projects/RagicEDP/documents/INCOMPLETE_WORK_DETECTION_PLAN.md

# 開始 Phase 1
# "開始實作 P0 核心功能"
```

---

## 文件版本

- **v1.0** - 初始規劃 (2025-12-26)
  - 完成架構設計
  - 確認檢測範圍
  - 設定實作優先級
  - 用戶確認方案

---

**保存時間**: 2025-12-26 16:54:03
**狀態**: 📋 規劃完成，等待指令
**預估工時**: P0 (11h) + P1 (6h) + P2 (13h) = **30 小時** (完整系統)

**下一步**: 等待您的指令開始實作 ⏳
