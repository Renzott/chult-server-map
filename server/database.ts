import { unlinkSync } from "node:fs";

const path = "./dataWithStatus.json";

export interface Hexagon {
    id: string;
    status: string;
    lastModified: string;
}

export const getAllHexagons = async (): Promise<Hexagon[]> => {
    const file = Bun.file(path);
    const text = await file.text();
    return JSON.parse(text) as Hexagon[];
};

export const updateHexagon = async (hexagonId: string, status: string): Promise<void> => {
    const hexagons = await getAllHexagons();
    const hexagon = hexagons.find((hex) => hex.id === hexagonId);

    if (status === "player") {
        for (const hex of hexagons) {
            if (hex.status === "player") {
                hex.status = "visible";
                hex.lastModified = new Date().toISOString();
            }
        }
    }
    if (!hexagon) {
        hexagons.push({
            id: hexagonId,
            status: status,
            lastModified: new Date().toISOString(),
        });
    } else {
        hexagon.status = status;
        hexagon.lastModified = new Date().toISOString();
    }

    const newText = JSON.stringify(hexagons, null, 4);
    unlinkSync(path);
    await Bun.write(path, newText);
};

export const getHexagon = async (hexagonId: string): Promise<Hexagon | undefined> => {
    const hexagons = await getAllHexagons();
    return hexagons.find((hexagon) => hexagon.id === hexagonId);
};