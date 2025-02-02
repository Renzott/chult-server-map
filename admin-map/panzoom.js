function PanZoom(selector, opts) {
  let panZoomEles = [];
  opts = opts || {};
  let minScale = opts.minScale ? opts.minScale : 0.1;
  let maxScale = opts.maxScale ? opts.maxScale : 5;
  let increment = opts.increment ? opts.increment : 0.05;
  let liner = opts.liner ? opts.liner : false;

  document.querySelectorAll(selector).forEach(function (ele, index) {
    let panZoomInstance = new AttachPanZoom(
      ele,
      minScale,
      maxScale,
      increment,
      liner,
      panZoomEles,
      index === 0
    );
    panZoomEles.push(panZoomInstance);
  });

  if (panZoomEles.length === 1) return panZoomEles[0];
  return panZoomEles[0];
}

function AttachPanZoom(ele, minScale, maxScale, increment, liner, panZoomEles, isPrimary) {
  this.increment = increment;
  this.minScale = minScale;
  this.maxScale = maxScale;
  this.liner = liner;
  this.panning = false;
  this.oldX = this.oldY = 0;
  this.velX = 0;
  this.velY = 0;
  this.friction = 0.94;
  this.mouseMoveHandlers = [];
  this.lastTransform = null;
  let self = this;
  ele.style.transform = "matrix(1, 0, 0, 1, 0, 0)";

  this.getLastTransform = function () {
    return this.lastTransform;
  }

  this.getTransformMatrix = function () {
    let trans = ele.style.transform;
    let start = trans.indexOf("(") + 1;
    let end = trans.indexOf(")");
    let matrix = trans.slice(start, end).split(",");
    return {
      scale: +matrix[0],
      transX: +matrix[4],
      transY: +matrix[5],
    };
  };

  this.setTransformMatrix = function (o) {
    ele.style.transform = `matrix(${o.scale}, 0, 0, ${o.scale}, ${o.transX}, ${o.transY})`;
    if (this.isUpdating) return;
    this.isUpdating = true;
    panZoomEles.forEach((instance) => {
      if (instance !== self) {
        instance.applySyncTransform(o);
      }
    });
    this.isUpdating = false;
  };

  this.applySyncTransform = function (syncData) {
    let newTrans = this.getTransformMatrix();
    newTrans.scale = syncData.scale;
    newTrans.transX = syncData.transX;
    newTrans.transY = syncData.transY;
    this.setTransformMatrix(newTrans);
  };

  this.applyTranslate = function (dx, dy) {
    let newTrans = this.getTransformMatrix();
    newTrans.transX += dx;
    newTrans.transY += dy;
    this.setTransformMatrix(newTrans);
  };

  this.smoothMove = function () {
    if (!self.panning) {
      self.velX *= self.friction;
      self.velY *= self.friction;
      if (Math.abs(self.velX) > 0.1 || Math.abs(self.velY) > 0.1) {
        self.applyTranslate(self.velX, self.velY);
        requestAnimationFrame(() => self.smoothMove());
      }
    }
  };

  this.applyScale = function (dscale, x, y) {
    let newTrans = this.getTransformMatrix();
    let width = ele.width ? ele.width : ele.offsetWidth;
    let height = ele.height ? ele.height : ele.offsetHeight;
    let tranX = x - width / 2;
    let tranY = y - height / 2;
    dscale = this.liner ? dscale : dscale * newTrans.scale;
    newTrans.scale += dscale;
    let maxOrMinScale = newTrans.scale <= this.minScale || newTrans.scale >= this.maxScale;
    if (newTrans.scale < this.minScale) newTrans.scale = this.minScale;
    if (newTrans.scale > this.maxScale) newTrans.scale = this.maxScale;
    if (!maxOrMinScale) {
      this.applyTranslate(tranX, tranY);
      this.setTransformMatrix(newTrans);
      this.applyTranslate(-tranX * dscale, -tranY * dscale);
    }
  };

  this.center = function () {
    let width = ele.width ? ele.width : ele.offsetWidth;
    let height = ele.height ? ele.height : ele.offsetHeight;

    let newTrans = this.getTransformMatrix();

    let x = (width - width) / 2;
    let y = (height - height) / 2;
    newTrans.transX = -x;
    newTrans.transY = -y;

    this.setTransformMatrix(newTrans);
  };

  const notifyMouseMoveHandlers = (e) => {
    self.mouseMoveHandlers.forEach((handler) => handler(e));
  };

  const handleMouseMove = (e) => {
    if (self.panning) {
      let deltaX = e.clientX - self.oldX;
      let deltaY = e.clientY - self.oldY;
      self.applyTranslate(deltaX, deltaY);
      self.oldX = e.clientX;
      self.oldY = e.clientY;
      self.velX = deltaX;
      self.velY = deltaY;
    }
    notifyMouseMoveHandlers(e);
  };

  const handleMouseUp = (e) => {
    self.panning = false;
    requestAnimationFrame(() => self.smoothMove());
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    self.panning = true;
    self.oldX = e.clientX;
    self.oldY = e.clientY;
    self.velX = 0;
    self.velY = 0;
    lastTransform = this.getTransformMatrix();
  };

  if (isPrimary) {
    ele.addEventListener("mousedown", handleMouseDown);
    ele.addEventListener("mouseup", handleMouseUp);
    ele.addEventListener("mouseleave", handleMouseUp);
    ele.addEventListener("mousemove", handleMouseMove);
  }

  this.getScrollDirection = (e) => {
    let delta = Math.max(-1, Math.min(1, e.wheelDelta || -e.detail));
    if (delta < 0) self.applyScale(-self.increment, e.offsetX, e.offsetY);
    else self.applyScale(self.increment, e.offsetX, e.offsetY);
  };

  ele.addEventListener("DOMMouseScroll", this.getScrollDirection, false);
  ele.addEventListener("mousewheel", this.getScrollDirection, false);

  this.addMouseMoveHandler = function (handler) {
    if (typeof handler === "function") {
      self.mouseMoveHandlers.push(handler);
    }
  };
}
