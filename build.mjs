import * as fs from 'fs'
import { execSync } from 'child_process'

async function getUIVariables() {
  const text = fs.readFileSync("build/seti-ui/styles/ui-variables.less", 'utf-8')
  const map = new Map
  // @blue: #519aba; ==> { "@blue": "#519aba" }
  const pattern = /(.*):(.*)/
  text.split("\n").map(line=> {
    if (!pattern.test(line)) return
    const [ , key, value ] = line.match(pattern)
    map.set(key, value)
  })
  return map
}

async function getIcons() {
  const colorMap = await getUIVariables()
  const text = fs.readFileSync("build/seti-ui/styles/components/icons/mapping.less", 'utf-8')
  const icons = []
  // .icon-set("webpack.dev.ts", "webpack", @blue); ==> [ 'webpack.dev.ts', 'webpack', '@blue' ]
  const pattern = /\.icon-(set|partial)\("(.*)",\s?"(.*)",\s?(.*)\)/
  text.split("\n").map(line=> {
    if (!pattern.test(line)) return
    const [ , _, file, icon, color ] = line.match(pattern)
    if (!colorMap.has(color)) return
    icons.push({
      file,
      icon,
      color: colorMap.get(color).trim(),
    })
  })
  return icons
}

const theme = {
  "$schema": "https://zed.dev/schema/icon_themes/v0.2.0.json",
  name: "Seti Icon Theme",
  author: "d1y",
  themes: [
    {
      name: "Seti Icon Theme",
      appearance: "dark",
      file_stems: {},
      file_suffixes: {},
      file_icons: {
        "default": { "path": "./icons/default.svg" },
      },
    }
  ]
}

if (!fs.existsSync("build/seti-ui")) {
  execSync("git clone https://github.com/jesseweed/seti-ui build/seti-ui")
}

fs.mkdirSync("icons", { recursive: true })
const tables = await getIcons()

const ignoreReplace = [
  'twig',
  'elm',
]
tables.forEach(table=> {
  const { file, icon, color } = table
  const oldSVGPath = `build/seti-ui/icons/${icon}.svg`
  let svgText = fs.readFileSync(oldSVGPath, 'utf-8')
  
  if (!ignoreReplace.includes(icon)) {
    svgText = svgText.replace(/color="[^"]*"/g, 'color="currentColor"')
    svgText = svgText.replace(/fill="[^"]*"/g, 'color="currentColor"')
    svgText = svgText.replace(/\.st0{fill:(\S*);?}/, `.st0{fill:${color}}`)
    svgText = svgText.replace(/\.st1{fill:(\S*);?}/, `.st1{fill:${color}}`)//stupid
  }
  
  if (icon == 'wgt') {
    svgText = svgText.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" `)
  }

  const _svg = svgText.replace('xmlns="http://www.w3.org/2000/svg"', `xmlns="http://www.w3.org/2000/svg" style="fill: ${color}"`)
  fs.writeFileSync('icons/' + icon + '.svg', _svg)
  if (file.startsWith(".")) {
    theme.themes[0].file_suffixes[file.substring(1)] = icon
  } else {
    theme.themes[0].file_stems[file] = icon
  }
  theme.themes[0].file_icons[icon] = { "path": `./icons/${icon}.svg` }
})

fs.writeFileSync("icon_themes/seti.json", JSON.stringify(theme, null, 2))