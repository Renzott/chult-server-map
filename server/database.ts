import { unlinkSync } from "node:fs";

const path = "./dataWithStatus.json"

export interface Hexagon {
    id: string
    status: string
    lastModified: string
}


export const getAllHexagons = async (): Promise<Hexagon[]> => {
    const file = Bun.file(path)
    const text = await file.text()
    return JSON.parse(text) as Hexagon[]
}

export const updateHexagon = async (hexagonId: string, status: string): Promise<void> => {
    const hexagons = await getAllHexagons()
    const hexagon = hexagons.find((hexagon: Hexagon) => hexagon.id === hexagonId)
    console.log(hexagon)
    if(!hexagon) return;

    if (hexagon) {
        hexagon.status = status
        hexagon.lastModified = new Date().toISOString()
    }
    const newText = JSON.stringify(hexagons, null, 4)
    const file = Bun.file(path)
    unlinkSync(path)
    let writer = file.writer()
    writer.write(newText)
}

export const getHexagon = async (hexagonId: string): Promise<Hexagon | undefined> => {
    const hexagons = await getAllHexagons()
    return hexagons.find((hexagon: Hexagon) => hexagon.id === hexagonId)
}



