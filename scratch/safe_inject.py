import json
import re
import ast

# 1. Extract translations from translate.py
with open('translate.py', 'r', encoding='utf-8') as f:
    translate_code = f.read()

# We can safely parse out the `translations = { ... }` block using regex for now, since it's well-formatted.
match = re.search(r'translations\s*=\s*(\{.*?\})', translate_code, re.DOTALL)
if match:
    dict_str = match.group(1)
    translations = ast.literal_eval(dict_str)
else:
    print("Failed to parse translations dict.")
    exit(1)

# 2. Read the TS file
ts_path = 'client/src/contexts/currentInterfaceTerms.ts'
with open(ts_path, 'r', encoding='utf-8') as f:
    ts_code = f.read()

# 3. Find the first `hi: { ... }` block
# We will use re.search to find the first occurrence inside currentInterfaceTerms
pattern = r'(export const currentInterfaceTerms.*?hi:\s*\{)(.*?)(\}(?:,\n|$))'
match = re.search(pattern, ts_code, re.DOTALL)

if not match:
    print("Failed to find hi: block in currentInterfaceTerms.")
    exit(1)

prefix = match.group(1)
existing_content = match.group(2).strip()
suffix = match.group(3)

# 4. Parse the existing content to avoid duplicates (just crude matching for now)
# The existing content looks like: "Key1": "Val1", "Key2": "Val2"
existing_keys = re.findall(r'"([^"]+)":', existing_content)

# Add only non-existing keys, OR just overwrite them?
# Let's overwrite them if they exist by reconstructing the whole thing, or just append new ones.
# The user wants to inject translations, so let's just append the ones that aren't already there.
# Wait, if `translate.py` has updated translations, we should overwrite.
# Let's just create a new dict for `hi` by merging existing and new.

# Safely extract all key-value pairs from existing_content
existing_pairs = re.findall(r'"([^"]+)":\s*"([^"]+)"', existing_content)
merged = {k: v for k, v in existing_pairs}
for k, v in translations.items():
    merged[k] = v

# Serialize back
new_inner_content = ", ".join([f'{json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}' for k, v in merged.items()])

new_ts_code = ts_code[:match.start(2)] + " " + new_inner_content + " " + ts_code[match.end(2):]

with open(ts_path, 'w', encoding='utf-8') as f:
    f.write(new_ts_code)

print("Successfully injected translations cleanly!")
