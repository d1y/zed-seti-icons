import * as fs from 'fs'
import { execSync } from 'child_process'
import req from 'request-promise'

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

// https://github.com/cncf/svg-autocrop
// https://autocrop.cncf.io
async function svgCrop(svg) {
  const baseUrl = 'https://autocrop.cncf.io/autocrop';
  const response = await req({
    method: 'POST',
    body: { svg },
    uri: baseUrl,
    json: true
  })
  const { success, result, error } = response
  if (!success) {
    console.log("autocrop failed: ", error)
    return ''
  }
  return result
}

const iconProcessed = new Set
for (const table of tables) {
  const { file, icon, color } = table

  if (!iconProcessed.has(icon)) {
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
    console.log("start process icon: ", icon)

    let realSvg = (await svgCrop(_svg)) || _svg
    if (icon == 'heroku') {
      realSvg = `<svg xmlns="http://www.w3.org/2000/svg" style="fill:#a074c4" viewBox="8 5 15 22"><path d="M9 26v-5.714l3.25 2.857L9 26zm11.742-11.58c1.243 1.242 1.26 2.826 1.258 3.009V26h-2.889v-8.532C19.097 16.8 18.772 16 17.306 16c-2.938 0-6.233 1.461-6.265 1.476L9 18.39V6h2.889v8.111c1.442-.464 3.458-.968 5.417-.968 1.785 0 2.854.694 3.436 1.277zm-3.798-3.777C18.08 9.17 18.793 7.619 19.111 6H22c-.195 1.623-.86 3.179-2.167 4.643h-2.889z"/></svg>`
    }
    fs.writeFileSync('icons/' + icon + '.svg', realSvg)
    iconProcessed.add(icon)
  }

  if (file.startsWith(".")) {
    theme.themes[0].file_suffixes[file.substring(1)] = icon
  } else {
    theme.themes[0].file_stems[file] = icon
  }
  theme.themes[0].file_icons[icon] = { "path": `./icons/${icon}.svg` }
}

fs.writeFileSync("icon_themes/seti.json", JSON.stringify(theme, null, 2))