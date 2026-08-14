# LinChat 角色插画接入流程（交接文档）

> 本文档记录登录页看板娘（方案 C「暗夜特工」）从生成到接入的完整流程与标准，
> 供后续 Agent（GPT 等）按同一标准将方案 A「战术指挥官」、方案 B「系统架构师」
> 接入设置页 / 错误页等页面。

## 一、既定设计决策（不要重新讨论）

- 品牌视觉：暗黑科技底（近黑 `#050508~#12121c`）、**红色主高光**（`#ff3b52` / `#ff4757`）、
  **蓝色边缘光**（`rgba(86,137,255,*)`）、奶白大字（`#f7f3ee`）、工业 HUD、等宽字体元数据。
- 角色统一约束：原创、成年感、冷静克制专业；禁止复刻 Cindy（短发白裙 / 黑猫 / 首饰）。
- 三套角色分工：
  | 角色 | 素材 | 去向 |
  | --- | --- | --- |
  | C 暗夜特工（银灰长发+编发，机甲臂） | 已接入 | 登录页（已完成） |
  | A 战术指挥官（黑长直，红纹制服，双臂交叉） | `concept-A-commander.png` | 设置页（待做） |
  | B 系统架构师（低发髻+眼镜，操作全息体） | `concept-B-architect.png` | 错误页/其他（待做） |
- 构图标准：**左人右表**（人物在左侧面板、功能区在右），人物不得压过功能区的视觉优先级。

## 二、素材生产管线

所有中间产物在 `C:\Users\Administrator\linchat-design\`（不在仓库内）。

1. **生成定稿图**（OpenAI Images API 兼容中转，模型 `gpt-image-2`）
   - 配置读取 `C:\Users\Administrator\.linchat-imagegen.env`（`OPENAI_BASE_URL` / `OPENAI_API_KEY` / `IMAGE_MODEL`，不要提交或外传）。
   - 请求 `POST {base}/images/generations`，`size: 1024x1536`，`quality: high`，返回 `b64_json`。
   - 注意：该中转有 Cloudflare 防护，必须带浏览器 User-Agent 头。
   - 定稿提示词要点：在概念稿描述基础上加
     `pure solid black background, NO holographic panels, NO text, NO HUD elements, character only, clean silhouette for background removal`
     （页面自带 HUD，图内 HUD 会打架）。
2. **抠背景**：rembg + `isnet-anime` 模型（动漫专用，发丝边缘干净）。
   - 工具 venv：`C:\Users\Administrator\linchat-design\venv\Scripts\python.exe`
   - `remove(img, session=new_session('isnet-anime'))` → 透明 PNG。
3. **4K 超分存档**：Real-ESRGAN（`C:\Users\Administrator\linchat-design\realesrgan\realesrgan-ncnn-vulkan.exe`）
   - `-n realesrgan-x4plus-anime -s 4`，对透明版和原图各做一份（4096×6144），留作海报/启动图。
4. **出 web 素材**：PIL 打开 4K 透明版 → `getbbox()` 裁掉透明边 → `thumbnail((1100,1650), LANCZOS)`
   → 存 WEBP `quality=82, method=6`，控制在 ~400KB。
   - 产物放 `public/brand/`，命名语义化（登录页用的是 `operative.webp`）。

## 三、页面接入标准（以登录页为模板）

参考实现：`app/components/auth.tsx` + `app/components/auth.module.scss`。

1. **图片元素**：面板内加 `<img className={styles["panel-character"]} src="/brand/xxx.webp" alt="" aria-hidden="true" />`，
   纯装饰图必须 `alt=""` + `aria-hidden`；Next 的 `no-img-element` 规则用行内 eslint-disable 豁免。
2. **定位**：`position: absolute; right/bottom` 锚定在左面板**朝向功能区的一侧**（人物视线朝表单），
   `z-index: 0`（在幽灵字之上、文案之下），`pointer-events: none; user-select: none`。
3. **可读性压暗层**：面板 `::before` 做左深右透的斜向渐变（z-index 1），文案层 z-index 高于它，
   保证人物上方的文字对比度。
4. **氛围光**：人物 `filter: drop-shadow` 双层——蓝色朝外侧、红色朝内侧（呼应蓝红边缘光）。
   底部 `mask-image` 渐隐，避免生硬裁切。
5. **入场动画**：`translateX` + 淡入（约 1.1s，延迟 0.35s），并**必须**加进
   `@media (prefers-reduced-motion: reduce)` 的豁免清单。
6. **响应式**：`≤760px` 隐藏人物和压暗层（`display: none`），移动端面板保持紧凑。
7. **布局余量**：接入人物的面板在网格中占比调宽（登录页是 `1.12fr / 0.88fr`，卡片 `min(1060px,100%)`）。
8. **防抖**：滚动容器加 `scrollbar-gutter: stable`，防止切标签页时滚动条闪现导致横向抖动。

## 四、配色映射表（改旧页面时直接套）

| 旧（蓝青海主题） | 新（暗黑红主题） |
| --- | --- |
| 青 `#3ee0ff` / `rgba(62,224,255,*)` | 红 `#ff3b52` / `rgba(255,59,82,*)` |
| 珊瑚 `#ff7e67` / `rgba(255,126,103,*)`（按钮/动作） | 红 `#ff4757` / `rgba(255,71,87,*)` |
| 金 `#f5c98a`（点缀光） | 粉红 `#ff96a0` |
| 海蓝底 `#04080f / #081625 / #0d2236` | 近黑 `#050508 / #0b0b12 / #12121c` |
| 泡沫白 `#eef6f9` / 墨 `#dce9f0` | 奶白 `#f7f3ee` / `#e8e4e6` |
| 次要蓝灰 `#7e95a6` | 紫灰 `#9a93a3` |
| 蓝色边缘光 | 保留 `rgba(86,137,255,*)`（仅辅助，如右下极光、人物外侧投影） |

SCSS 变量名（`--cyan`、`--coral` 等）**保持不变**只改值，减少 diff；详见 `auth.module.scss` 头部注释。

## 五、验收清单

- `yarn lint` 无新增告警；`yarn test:ci` 通过。
- 桌面首屏人物完整可见、不遮挡功能区文字；移动端人物隐藏后布局正常。
- 切换浏览器标签页往返无布局抖动。
- `prefers-reduced-motion` 下无动画。
- 图片体积 ≤ 500KB，透明边已裁剪。

## 六、本次登录页改动涉及的文件（待提交）

| 文件 | 变更 |
| --- | --- |
| `app/components/auth.tsx` | 新增人物 `<img>`；「进入 NextChat」→「进入 LinChat」 |
| `app/components/auth.module.scss` | 全量换色（映射表见上）；新增 `.panel-character` / 压暗层 / 响应式与 reduced-motion 条目；网格比例 `1.12fr/0.88fr`、卡片 1060px；输入框 50→44px、提交按钮 54→48px；`scrollbar-gutter: stable` |
| `public/brand/operative.webp` | 新增：登录页角色素材（1096×1650，~415KB） |
| `docs/character-art-pipeline.md` | 新增：本文档 |

按仓库规则，git 提交由您执行，建议命令：

```bash
git add app/components/auth.tsx app/components/auth.module.scss public/brand/operative.webp docs/character-art-pipeline.md
git commit -m "✨ feat(auth): 登录页接入原创角色立绘并切换暗黑红主题

- 新增暗夜特工角色立绘（左人右表构图，蓝红边缘光，响应式隐藏）
- 配色由蓝青海主题整体迁移至暗黑红主题
- 输入框与提交按钮尺寸收紧；修复切标签页横向抖动
- 新增角色插画接入流程交接文档"
```
