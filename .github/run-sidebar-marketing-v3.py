from pathlib import Path

script_path = Path('.github/update-sidebar-marketing-v2.py')
script = script_path.read_text()
marker = '    "dashboard content offset",\n'
marker_index = script.index(marker)
block_start = script.rfind('text = first(', 0, marker_index)
block_end = script.index('\n)\n', marker_index) + 3
replacement = '''if 'md:pl-[76px]' not in text or 'md:pl-[292px]' not in text:
    raise RuntimeError("dashboard content offset: target not found")
text = text.replace('md:pl-[76px]', 'md:pl-[72px]', 1)
text = text.replace('md:pl-[292px]', 'md:pl-[248px]', 1)
'''
script = script[:block_start] + replacement + script[block_end:]
namespace = {'__name__': '__main__', '__file__': str(script_path)}
exec(compile(script, str(script_path), 'exec'), namespace)
