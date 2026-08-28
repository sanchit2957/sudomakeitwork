import os
import json

with open('translate.py', 'r', encoding='utf8') as f:
    code = f.read()

code = code.replace(
    'hi_str = ", ".join([f\'"{k}": "{v}"\' for k, v in translations.items()])',
    'hi_str = ", ".join([f\'{json.dumps(k)}: {json.dumps(v)}\' for k, v in translations.items()])'
)

code = code.replace(
    'new_content = re.sub(pattern, replacer, content)',
    'new_content = re.sub(pattern, replacer, content, flags=re.DOTALL)'
)

with open('translate.py', 'w', encoding='utf8') as f:
    f.write(code)

print("Fixed translate.py")
