
path = r'c:\Users\UsmanGanaev\Desktop\powerbi\frontend\src\app\page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove lines 421-427 (0-indexed: 420 to 426)
del lines[420:427]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Fixed")
