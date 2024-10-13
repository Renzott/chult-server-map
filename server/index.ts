import { getAllHexagons, updateHexagon, type Hexagon } from "./database";
import { pack, unpack } from 'msgpackr';

const MASTER_KEY =  process.env.MASTER_KEY || 'master-key';

interface MessageData {
    payload: any
    action: string
}

interface WebSocketData {
    masterKey: string
}

Bun.serve<WebSocketData>({
    port: 7555,
    fetch(req, server) {
        const masterKey = getUUIDFromURL(req.url)

        const success = server.upgrade(req, { data: { masterKey } });
        if (success) return undefined;
        return new Response("Hello world!");
    },
    websocket: {
        async open(ws) {
            if (ws.data.masterKey !== MASTER_KEY && ws.data.masterKey !== null) {

                let errorData: MessageData = {
                    payload: 'Acceso denegado: Master Key no válido.',
                    action: 'no-access'
                };
                ws.send(new Uint8Array(pack(errorData)));
                ws.close();
                return;
            }
            ws.subscribe("hexagon-updates");
            const initialHexagons = await getAllHexagons();
            const initialData: MessageData = {
                payload: initialHexagons,
                action: "initial-hexagons",
            };
            const packedData = pack(initialData);
            ws.send(new Uint8Array(packedData));
        },
        message(ws, message) {
            let unpackData: MessageData = unpack(message as unknown as Uint8Array);
            switch (unpackData.action) {
                case "update-hexagon":
                    if (ws.data.masterKey !== MASTER_KEY) {

                        let errorData: MessageData = {
                            payload: 'Acceso denegado: Master Key no válido.',
                            action: 'no-access'
                        };

                        ws.send(new Uint8Array(pack(errorData)));
                        return;
                    }
                    const { id, status } = unpackData.payload as Hexagon;
                    const data: MessageData = {
                        payload: unpackData.payload,
                        action: "hexagon-update",
                    };

                    let packedData = pack(data);
                    ws.publish("hexagon-updates", new Uint8Array(packedData));
                    ws.send(new Uint8Array(packedData));
                    updateHexagon(id, status);
                    break;
                case 'ping':
                    let message: MessageData = {
                        payload: 'pong',
                        action: 'pong'
                    };
                    let packedPong = pack(message);
                    ws.send(new Uint8Array(packedPong));
                    break;
                default:
                    ws.send('Acción no válida.');
                    break;
            }
        },
        close(ws) {
            ws.unsubscribe("hexagon-updates");
        },
    },
    idleTimeout: 255,
});

function getUUIDFromURL(url: string): string | null {
    const splitURL = url.split('?');
    if (splitURL.length !== 2) return null;
    const [_, params] = splitURL;
    const urlParams = new URLSearchParams(params);
    return urlParams.get('key');
}


