# 内置内容示例

> 把你的讲义 md 文件放进本目录(`docs/content/`),并在 `content.json` 清单里登记,
> 访客首次打开站点时会自动装载进资料库的「内置讲义」文件夹——零手动导入。

## 清单格式(content.json)

```json
{
  "folder": "内置讲义",
  "items": [
    { "name": "第 1 讲 · 课程导论.md", "file": "lesson-01.md", "group": "" },
    { "name": "第 2 讲 · 动手实操.md", "file": "lesson-02.md", "group": "进阶篇" }
  ]
}
```

- `folder`:资料库里的根文件夹名(默认「内置讲义」)
- `items[].name`:列表中的显示名
- `items[].file`:同目录下的 md 文件名
- `items[].group`:可选,二级分组文件夹名

## 渲染能力验证

代码高亮:

```python
def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
```

数学公式:行内 $E = mc^2$,块级:

$$
\\int_{-\\infty}^{+\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

Mermaid 图表:

```mermaid
graph LR
    A[放入 content/] --> B[登记 content.json]
    B --> C[访客首启自动装载]
    C --> D[离线可读]
```

> 删除本示例、换成你的讲义,即完成一个讲义项目的接入。
