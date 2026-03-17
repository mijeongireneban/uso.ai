import Cocoa

// Icon: 1024×1024, dark rounded-square background, white "u" lettermark
let size = 1024
let nsSize = NSSize(width: size, height: size)

let image = NSImage(size: nsSize)
image.lockFocus()

guard let ctx = NSGraphicsContext.current?.cgContext else {
    print("ERROR: no graphics context")
    exit(1)
}

// Background: dark charcoal (#1a1a1a), rounded square with corner radius ~23%
let bg = CGColor(red: 0.08, green: 0.08, blue: 0.08, alpha: 1.0)
let cornerRadius = CGFloat(size) * 0.23
let rect = CGRect(x: 0, y: 0, width: size, height: size)
let path = CGPath(roundedRect: rect, cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil)

ctx.setFillColor(bg)
ctx.addPath(path)
ctx.fillPath()

// Draw "u" lettermark in white using system font
let fontName = "Helvetica Neue"
let fontSize = CGFloat(size) * 0.62
let font = NSFont(name: fontName, size: fontSize) ?? NSFont.systemFont(ofSize: fontSize, weight: .regular)

let attrs: [NSAttributedString.Key: Any] = [
    .font: font,
    .foregroundColor: NSColor.white,
]

let letter = NSAttributedString(string: "u", attributes: attrs)
let textSize = letter.size()

// Center the glyph
let x = (CGFloat(size) - textSize.width) / 2
let y = (CGFloat(size) - textSize.height) / 2 + CGFloat(size) * 0.02

letter.draw(at: NSPoint(x: x, y: y))

image.unlockFocus()

// Save to PNG
guard let tiffData = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData),
      let pngData = bitmap.representation(using: .png, properties: [:]) else {
    print("ERROR: failed to encode PNG")
    exit(1)
}

let outputPath = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "/tmp/uso-icon.png"
try! pngData.write(to: URL(fileURLWithPath: outputPath))
print("Icon saved to \(outputPath)")
