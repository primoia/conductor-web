#!/usr/bin/env python3
"""
Gerador de ícones PWA para Conductor
Cria ícones em vários tamanhos a partir de um ícone base
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_conductor_icon(size):
    """Cria um ícone do Conductor com gradiente"""
    # Criar imagem com gradiente roxo
    img = Image.new('RGB', (size, size))
    draw = ImageDraw.Draw(img)

    # Gradiente de roxo (#667eea) para roxo escuro (#764ba2)
    for y in range(size):
        # Interpolar cores
        ratio = y / size
        r = int(102 + (118 - 102) * ratio)
        g = int(126 + (75 - 126) * ratio)
        b = int(234 + (162 - 234) * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b))

    # Adicionar letra "C" no centro
    try:
        # Tentar usar fonte do sistema
        font_size = int(size * 0.6)
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        # Fallback para fonte padrão
        font = ImageFont.load_default()

    # Desenhar "C" branco no centro
    text = "C"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (size - text_width) // 2
    y = (size - text_height) // 2 - bbox[1]

    draw.text((x, y), text, fill='white', font=font)

    # Adicionar borda arredondada (criar máscara)
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([(0, 0), (size, size)], radius=size//8, fill=255)

    # Aplicar máscara
    output = Image.new('RGBA', (size, size))
    output.paste(img, (0, 0))
    output.putalpha(mask)

    return output

def main():
    """Gera todos os ícones necessários"""
    sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    output_dir = 'src/assets/icons'

    os.makedirs(output_dir, exist_ok=True)

    print("🎨 Gerando ícones PWA para Conductor...")

    for size in sizes:
        icon = create_conductor_icon(size)
        output_path = os.path.join(output_dir, f'icon-{size}x{size}.png')
        icon.save(output_path, 'PNG')
        print(f"  ✅ Criado: {output_path}")

    print("\n✨ Todos os ícones foram gerados com sucesso!")
    print("\n📱 Próximos passos:")
    print("  1. Recompile o projeto: npm run build")
    print("  2. Acesse no tablet: http://192.168.0.119:4200/screenplay")
    print("  3. Menu (⋮) → 'Adicionar à tela inicial'")
    print("  4. Abra pelo ícone na tela inicial = Tela cheia! 🚀")

if __name__ == '__main__':
    main()
