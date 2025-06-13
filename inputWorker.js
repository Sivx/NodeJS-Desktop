const { parentPort } = require("worker_threads");
const robot = require("robotjs");

let agg = { dx: 0, dy: 0 };
let debounceTimer = null;

parentPort.on("message", (data) => {
  try {
    switch (data.type) {
      case "keydown":
        if (data.key.startsWith("Arrow")) data.key = data.key.slice(5);
        robot.keyToggle(data.key.toLowerCase(), "down");
        break;
      case "keyup":
        if (data.key.startsWith("Arrow")) data.key = data.key.slice(5);
        robot.keyToggle(data.key.toLowerCase(), "up");
        break;
      case "mousemove":
        const screenSize = robot.getScreenSize();
        robot.moveMouse(
          Math.min(Math.max(data.x, 0), screenSize.width - 1),
          Math.min(Math.max(data.y, 0), screenSize.height - 1)
        );
        break;
      case "mousedown":
        robot.mouseToggle(
          "down",
          ["left", "middle", "right"][data.button] || "left"
        );
        break;
      case "mouseup":
        robot.mouseToggle(
          "up",
          ["left", "middle", "right"][data.button] || "left"
        );
        break;
      case "wheel":
        agg.dx += Math.trunc(data.deltaX);
        agg.dy += Math.trunc(data.deltaY);
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          console.log("Scrolling:", agg.dx, agg.dy);
          robot.scrollMouse(agg.dx, agg.dy);
          agg.dx = 0;
          agg.dy = 0;
        }, 500);
        break;
      case "getScreenSize":
        const size = robot.getScreenSize();
        parentPort.postMessage({ type: "screenSize", size });
        break;
    }
  } catch (err) {
    console.error("Worker error:", err);
    console.error("Data received:", data);
  }
});
