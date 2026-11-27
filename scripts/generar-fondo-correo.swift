// Dibuja el fondo del correo oscuro (public/correo/fondo-oscuro.png): las mismas formas de la página de reservas, muy suaves.
// Uso: swift scripts/generar-fondo-correo.swift public/correo/fondo-oscuro.png
import AppKit

let W = 1200, H = 1800
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: W, pixelsHigh: H, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let g = NSGraphicsContext.current!.cgContext
g.setFillColor(CGColor(red: 11/255, green: 11/255, blue: 12/255, alpha: 1))
g.fill(CGRect(x: 0, y: 0, width: W, height: H))
g.setLineCap(.round); g.setLineJoin(.round)

// tipo, x, y (desde arriba), tamaño, opacidad, giro en grados
let formas: [(String, Double, Double, Double, Double, Double)] = [
  ("circulo", 110, 120, 170, 0.13, 0), ("cuadrado", 1040, 190, 100, 0.14, 18), ("triangulo", 960, 520, 110, 0.08, -14),
  ("asterisco", 80, 520, 120, 0.15, 20), ("cruz", 1120, 820, 80, 0.18, 0), ("relleno", 60, 960, 74, 0.08, 24),
  ("arco", 940, 1140, 300, 0.15, -8), ("circulo", 1110, 1390, 110, 0.11, 0), ("asterisco", 120, 1370, 150, 0.12, -12),
  ("cuadrado", 90, 1680, 96, 0.12, -20), ("cruz", 1040, 1660, 66, 0.16, 15), ("triangulo", 520, 1750, 80, 0.06, 30),
]
for (tipo, x, yArriba, t, o, giro) in formas {
  g.saveGState()
  g.translateBy(x: x, y: Double(H) - yArriba); g.rotate(by: giro * .pi / 180)
  let c = CGColor(red: 1, green: 1, blue: 1, alpha: o)
  g.setStrokeColor(c); g.setFillColor(c); g.setLineWidth(6)
  let r = t / 2
  switch tipo {
  case "circulo": g.strokeEllipse(in: CGRect(x: -r, y: -r, width: t, height: t))
  case "cuadrado": g.addPath(CGPath(roundedRect: CGRect(x: -r, y: -r, width: t, height: t), cornerWidth: t*0.17, cornerHeight: t*0.17, transform: nil)); g.strokePath()
  case "relleno": g.addPath(CGPath(roundedRect: CGRect(x: -r, y: -r, width: t, height: t), cornerWidth: t*0.28, cornerHeight: t*0.28, transform: nil)); g.fillPath()
  case "triangulo": g.move(to: CGPoint(x: 0, y: r)); g.addLine(to: CGPoint(x: r, y: -r*0.75)); g.addLine(to: CGPoint(x: -r, y: -r*0.75)); g.closePath(); g.fillPath()
  case "asterisco": for a in [0.0, 45, 90, 135] { let dx = cos(a * .pi/180)*r, dy = sin(a * .pi/180)*r; g.move(to: CGPoint(x: -dx, y: -dy)); g.addLine(to: CGPoint(x: dx, y: dy)) }; g.strokePath()
  case "cruz": g.move(to: CGPoint(x: -r, y: 0)); g.addLine(to: CGPoint(x: r, y: 0)); g.move(to: CGPoint(x: 0, y: -r)); g.addLine(to: CGPoint(x: 0, y: r)); g.strokePath()
  default: g.setLineDash(phase: 0, lengths: [20, 26]); g.move(to: CGPoint(x: -r, y: 20)); g.addQuadCurve(to: CGPoint(x: r, y: 20), control: CGPoint(x: 0, y: -90)); g.strokePath()
  }
  g.restoreGState()
}
NSGraphicsContext.restoreGraphicsState()
let salida = CommandLine.arguments[1]
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: salida))
print("listo", salida)
