const path = "./data.json"
const file = Bun.file(path)

const text = await file.text()

const hexagons = JSON.parse(text)

const hexagonsWithStatus = hexagons.map((hexagon: { row: any; col: any }) => ({
    id: `${hexagon.row}-${hexagon.col}`,
    status: 'inactive',
    lastModified: null
}))

const newText = JSON.stringify(hexagonsWithStatus, null, 4)

// save the new text in new file

const newPath = "./dataWithStatus.json"
const newFile = Bun.file(newPath)

let writer = newFile.writer()

writer.write(newText)