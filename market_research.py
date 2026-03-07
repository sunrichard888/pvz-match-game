import requests
import json

api_key = "5729bc83f54732b154e28cb6a3738b327d4ef5f8"
headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}

searches = [
    "羊了个羊 游戏机制 玩法设计 关卡设计",
    "match-3 stack puzzle game mechanics design",
    "麻将连连看 堆叠消除 游戏设计",
    "三消游戏 关卡难度曲线 数值设计",
    "休闲小游戏 广告变现 内购设计",
]

for i, query in enumerate(searches, 1):
    print(f"=== 搜索 {i}: {query} ===\n")
    r = requests.post("https://google.serper.dev/search", json={"q": query}, headers=headers, timeout=15)
    result = r.json()
    if "organic" in result:
        for item in result["organic"][:3]:
            title = item.get("title", "")
            snippet = item.get("snippet", "")[:200]
            link = item.get("link", "")
            print(f"【{title}】")
            print(f"{snippet}...")
            print(f"{link}\n")
    print("\n" + "="*60 + "\n")
