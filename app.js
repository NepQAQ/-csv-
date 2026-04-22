let words = []

// 页面加载时读取本地缓存
window.onload = () => {
  const saved = localStorage.getItem("words")
  if (saved) {
    words = JSON.parse(saved)
  }
}

// 导入 CSV
function importCSV() {
  const file = document.getElementById("csvFile").files[0]
  if (!file) {
    alert("请选择 CSV 文件")
    return
  }

  const reader = new FileReader()
  reader.onload = function (e) {
    const text = e.target.result
    const lines = text.split("\n")

    words = lines.map(line => {
      const [hiragana, katakana, chinese, reading] = line.split(",")
      return { hiragana, katakana, chinese, reading }
    })

    localStorage.setItem("words", JSON.stringify(words))
    alert("导入成功，共 " + words.length + " 条")
  }

  reader.readAsText(file, "utf-8")
}

// 搜索
function doSearch() {
  const keyword = document.getElementById("search").value
  const results = words.filter(item =>
    item.hiragana?.includes(keyword) ||
    item.katakana?.includes(keyword) ||
    item.chinese?.includes(keyword)
  )

  const container = document.getElementById("results")
  container.innerHTML = results
    .map(item => `
      <div class="item">
        <b>${item.hiragana} / ${item.katakana}</b><br>
        ${item.chinese}<br>
        <small>${item.reading}</small>
      </div>
    `)
    .join("")
}
