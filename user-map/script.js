async function initialize() {
  const { uuid4 } = await import(
    "https://cdn.jsdelivr.net/gh/tracker1/node-uuid4/browser.mjs"
  )

  const uuid = localStorage.getItem("uuid") || uuid4()
  localStorage.setItem("uuid", uuid)

  const playerId = document.getElementById("player-id")
  playerId.innerText = `ID: ${uuid.slice(0, 4)}`

  const panZoomInstance = PanZoom(".panzoom, .panzoom2", {
    increment: 0.1,
    minScale: 0.2,
    maxScale: 1,
  })

  const imageUrl = "bigMap.jpg"

  const img = await loadImage(imageUrl)

  const mapWidth = img.width
  const mapHeight = img.height
  const hexRadius = 36
  const borderWeight = 2
  const hexHeight = Math.sqrt(3) * (hexRadius + borderWeight)
  const hexWidth = 2 * (hexRadius + borderWeight)
  const vertDist = hexHeight
  const horizDist = hexWidth * 0.75

  const hexagonsMap = new Map()
  this.cursorClickStatus = "master"
  this.lastHexagonPlayer = null

  this.mapWidth = mapWidth
  this.mapHeight = mapHeight
  this.hexRadius = hexRadius
  this.borderWeight = borderWeight
  this.vertDist = vertDist
  this.horizDist = horizDist
  this.hexRadius = hexRadius
  this.hexHeight = hexHeight
  this.hexWidth = hexWidth
  let hasMouseInWindow = false

  let cursorsArray = []

  const mainCanvas = document.getElementById("canvas")
  const mainCtx = canvas.getContext("2d")

  const cursorCanvas = document.getElementById("cursorCanvas")
  const cursorCtx = cursorCanvas.getContext("2d")

  mainCanvas.width = mapWidth
  mainCanvas.height = mapHeight
  mainCanvas.style.width = `${mapWidth}px`
  mainCanvas.style.height = `${mapHeight}px`

  cursorCanvas.width = mapWidth
  cursorCanvas.height = mapHeight
  cursorCanvas.style.width = `${mapWidth}px`
  cursorCanvas.style.height = `${mapHeight}px`

  mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
  mainCtx.drawImage(img, 0, 0, mainCanvas.width, mainCanvas.height)

  let mousePos = { x: 0, y: 0 }
  let lerpSpeed = 0.1

  function drawAllCursors() {
    cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height)
    cursorsArray.forEach((cursor) => {
      drawCursor(cursor, cursorCtx)
    })
  }

  function drawCursor(cursor) {
    cursorCtx.beginPath()
    cursorCtx.arc(cursor.x, cursor.y, 15, 0, 2 * Math.PI)
    cursorCtx.fillStyle = "rgba(255, 0, 0, 0.5)"
    cursorCtx.fill()
    let text = "Player " + cursor.uuid.slice(0, 4)
    cursorCtx.font = "700 16px Arial"
    cursorCtx.fillStyle = "Red"
    cursorCtx.strokeStyle = "white"
    cursorCtx.lineWidth = 4
    cursorCtx.strokeText(text, cursor.x - text.length * 3, cursor.y - 20)
    cursorCtx.fillText(text, cursor.x - text.length * 3, cursor.y - 20)
  }

  function lerp(start, end, t) {
    return start + (end - start) * t
  }

  function updateCursorPositions() {
    cursorsArray.forEach((cursor) => {
      cursor.x = lerp(cursor.x, cursor.targetX, lerpSpeed)
      cursor.y = lerp(cursor.y, cursor.targetY, lerpSpeed)
    })
    drawAllCursors()
    requestAnimationFrame(updateCursorPositions)
  }

  this.handleCenterButtonClick = () => {
    panZoomInstance.center()
  }

  panZoomInstance.addMouseMoveHandler((e) => {
    mousePos.x = e.offsetX
    mousePos.y = e.offsetY
  })

  // ---------------------- WebSocket ----------------------

  let hasSocketClosed = false

  function setupWebSocket() {
    const hostname = window.location.hostname
    const wsURL =
      hostname === "localhost" ? `ws://${hostname}:7555` : `ws://${hostname}/ws`
    const socket = new WebSocket(wsURL)

    let pingInterval
    let cursorInterval

    socket.addEventListener("open", () => {
      hasSocketClosed = false
      logMessage("Conexión WebSocket abierta", "info", true)
      pingInterval = setInterval(() => {
        socket.send(encodeData({ action: "ping" }))
      }, 5000)
    })

    socket.addEventListener("message", async function (event) {
      const blob = event.data
      const arrayBuffer = await blob.arrayBuffer()
      const { payload: currentData, action } = msgpack.decode(
        new Uint8Array(arrayBuffer)
      )

      switch (action) {
        case "initial-hexagons":
          let lastHexagonId = null
          currentData.forEach((hexagon) => {
            let currentStatus =
              hexagon.status !== undefined ? hexagon.status : "hidden"

            if (hexagon.status === "player") {
              lastHexagonId = hexagon.id
            }
            hexagonsMap.set(hexagon.id, { status: currentStatus })
          })
          drawAllHexagons(mainCtx, mainCanvas, img, hexagonsMap)
          if (lastHexagonId) {
            lastHexagonPlayer = hexIdToCoords(lastHexagonId)
          }
          await hideLoadingScreen()
          break
        case "hexagon-update":
          if (lastHexagonPlayer) {
            const lastHexagonId = `${lastHexagonPlayer.row}-${lastHexagonPlayer.col}`
            hexagonsMap.set(lastHexagonId, { status: "visible" })
          }

          const { id, status } = currentData
          hexagonsMap.set(id, { status })
          logMessage(`Hexágono ${id} actualizado`, "info", true)
          drawAllHexagons(mainCtx, mainCanvas, img, hexagonsMap)
          if (status === "player") {
            lastHexagonPlayer = hexIdToCoords(id)
          }
          break
        case "pong":
          logMessage("Ping recibido del servidor", "info")
          break
        case "clear":
          break
        case "cursor-update":
          const { x, y, uuid } = currentData
          const cursorIndex = cursorsArray.findIndex((c) => c.uuid === uuid)
          if (cursorIndex > -1) {
            cursorsArray[cursorIndex].targetX = x
            cursorsArray[cursorIndex].targetY = y
          } else {
            cursorsArray.push({ x, y, targetX: x, targetY: y, uuid })
          }
          break
        default:
          logMessage("Acción desconocida recibida", "warning", true)
          break
      }
    })

    cursorInterval = setInterval(() => {
      if (hasMouseInWindow && socket.readyState === 1) {
        socket.send(
          encodeData({
            action: "cursor-move",
            payload: { x: mousePos.x, y: mousePos.y, uuid },
          })
        )
      }
    }, 60)

    socket.addEventListener("close", () => {
      clearInterval(pingInterval)
      clearInterval(cursorInterval)
      if (!hasSocketClosed) {
        logMessage("Conexión WebSocket cerrada", "warning", true)
      }
      hasSocketClosed = true
      setTimeout(() => {
        logMessage("Reconectando...", "warning", true)
        setupWebSocket()
      }, 5000)
    })
  }

  cursorCanvas.addEventListener("mouseleave", () => {
    hasMouseInWindow = false
  })

  cursorCanvas.addEventListener("mouseenter", () => {
    hasMouseInWindow = true
  })

  document.addEventListener("mouseleave", () => {
    hasMouseInWindow = false
  })

  document.addEventListener("mouseenter", () => {
    hasMouseInWindow = true
  })

  setupWebSocket()
  updateCursorPositions()
}

window.onload = async function () {
  await initialize()
}

// ---------------------- utils ---------------------- //

const setupWebSocket = () => {
  const hostname = window.location.hostname
  const wsURL =
    hostname === "localhost" ? `ws://${hostname}:7555` : `ws://${hostname}/ws`

  return new WebSocket(wsURL)
}

const logMessage = (message, type = "info", showToast = false) => {
  let color = "color: white"
  let toastColor = "#333"

  switch (type) {
    case "info":
      color = "color: green"
      toastColor = "#2ecc71"
      break
    case "warning":
      color = "color: orange"
      toastColor = "#f39c12"
      break
    case "error":
      color = "color: red"
      toastColor = "#e74c3c"
      break
  }

  console.log(
    `%c[${new Date().toLocaleTimeString()}]: %c${message}`,
    color,
    "color: white"
  )

  if (showToast) {
    Toastify({
      text: message,
      duration: 3000,
      close: true,
      gravity: "top",
      position: "right",
      style: {
        background: toastColor,
      },
    }).showToast()
  }
}

const encodeData = (data) => {
  return msgpack.encode(data)
}

const drawAllHexagons = (ctx, canvas, backgroundImage, hexagonsMap) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height)

  for (let col = 0; col * horizDist < mapWidth; col++) {
    for (let row = 0; row * vertDist < mapHeight; row++) {
      const x = col * horizDist
      const y = mapHeight - row * vertDist - (col % 2) * (hexHeight / 2)

      if (
        x + hexRadius > mapWidth ||
        x - hexRadius < 0 ||
        y + hexRadius > mapHeight ||
        y - hexRadius < 0
      ) {
        continue
      }

      if (lastHexagonPlayer) {
        if (lastHexagonPlayer.row === row && lastHexagonPlayer.col === col)
          continue
      }

      const hexId = `${row}-${col}`
      const hexStatus = hexagonsMap.get(hexId)?.status
      const isHidden = hexagonsMap.has(hexId) ? hexStatus === "hidden" : false
      drawHexagon(ctx, x, y, !isHidden, hexStatus)
    }
  }
}

const hexIdToCoords = (hexId) => {
  const [row, col] = hexId.split("-").map(Number)
  return { row, col }
}

const drawHexagon = (ctx, x, y, isHidden = false, status) => {
  if (isHidden && status != "player") return
  ctx.beginPath()
  hexPoints.forEach(([dy, dx], i) => {
    const px = x + (hexRadius + borderWeight) * dx
    const py = y + (hexRadius + borderWeight) * dy
    if (i === 0) {
      ctx.moveTo(px, py)
    } else {
      ctx.lineTo(px, py)
    }
  })
  ctx.closePath()

  if (status === "player") {
    ctx.fillStyle = "#fb9119"
  } else {
    ctx.fillStyle = isHidden ? "transparent" : "#FFF5DC"
  }
  ctx.globalAlpha = 1
  ctx.fill()
  ctx.strokeStyle = isHidden && "black"
  ctx.lineWidth = borderWeight
  ctx.stroke()
}

const isPointInHexagon = (px, py, hexX, hexY) => {
  let inside = false
  const buffer = 0.1

  for (let i = 0, j = hexPoints.length - 1; i < hexPoints.length; j = i++) {
    const xi = hexX + hexPoints[i][0] * hexRadius
    const yi = hexY + hexPoints[i][1] * hexRadius
    const xj = hexX + hexPoints[j][0] * hexRadius
    const yj = hexY + hexPoints[j][1] * hexRadius

    const intersect =
      yi + buffer > py !== yj + buffer > py &&
      px + buffer < ((xj - xi) * (py - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }
  return inside
}

const hexPoints = Array.from({ length: 6 }, (_, i) => {
  const angle = (Math.PI / 3) * i
  return [Math.sin(angle), Math.cos(angle)]
})

const loadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (err) => reject(err)
    img.src = url
  })
}

const hideLoadingScreen = async () => {
  document.querySelector(".fullscreen-container").style.opacity = 0
  await new Promise((resolve) => setTimeout(resolve, 500))
  document.querySelector(".fullscreen-container").style.display = "none"
}