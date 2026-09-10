import re
import json

file_path = r"d:\sudomakeitwork-1\client\src\contexts\currentInterfaceTerms.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# We will add translations to the sharedInterfaceTerms or currentInterfaceTerms.
# Actually, the user's strings are from the interface. Let's just add them to sharedInterfaceTerms or currentInterfaceTerms.
# Let's just append to the 'hi' dictionary in currentInterfaceTerms.

translations = {
  "Safety": "सुरक्षा",
  "Nearby hospital information": "आसपास के अस्पताल की जानकारी",
  "Stay safe, stay informed": "सुरक्षित रहें, जागरूक रहें",
  "Find verified nearby medical care. For immediate danger, send an SOS now.": "सत्यापित नजदीकी चिकित्सा देखभाल खोजें। तत्काल खतरे के लिए, अभी SOS भेजें।",
  "Call 112": "112 पर कॉल करें",
  "Rapid SOS": "त्वरित SOS",
  "Verified medical care": "सत्यापित चिकित्सा देखभाल",
  "Nearby hospitals": "आसपास के अस्पताल",
  "Nearest verified hospital shown first": "निकटतम सत्यापित अस्पताल पहले दिखाया गया है",
  "Finding hospitals near you…": "आपके आस-पास अस्पताल खोजा जा रहा है…",
  "Use location to sort hospitals by distance": "दूरी के अनुसार अस्पताल छांटने के लिए स्थान का उपयोग करें",
  "Refresh nearby hospitals": "आसपास के अस्पतालों को रिफ्रेश करें",
  "Get directions": "रास्ता प्राप्त करें",
  "Open": "खुला है",
  "Beds ready": "बेड उपलब्ध",
  "ICU ready": "ICU उपलब्ध",
  "of": "में से",
  "total": "कुल",
  "Food": "भोजन",
  "Medicine": "दवा",
  "Water": "पानी",
  "Power": "बिजली",
  "Updated": "अपडेट किया गया",
  "Call": "कॉल करें",
  "No call number": "कोई कॉल नंबर नहीं",
  "Loading verified hospitals…": "सत्यापित अस्पताल लोड हो रहे हैं…",
  "No verified hospital listed nearby": "आसपास कोई सत्यापित अस्पताल सूचीबद्ध नहीं है",
  "Hospital information appears here after a hospital is verified and staff publish its current capacity.": "अस्पताल के सत्यापित होने और कर्मचारियों द्वारा इसकी वर्तमान क्षमता प्रकाशित करने के बाद अस्पताल की जानकारी यहाँ दिखाई देती है।",
  "Flood safety now": "बाढ़ से सुरक्षा",
  "Move higher": "ऊंचे स्थान पर जाएं",
  "Leave low ground before water rises.": "पानी का स्तर बढ़ने से पहले निचले इलाके को छोड़ दें।",
  "Avoid water": "पानी से बचें",
  "Never walk or drive through moving water.": "बहते पानी में कभी न चलें और न ही गाड़ी चलाएं।",
  "Keep contact": "संपर्क बनाए रखें",
  "Charge your phone and keep emergency numbers ready.": "अपना फोन चार्ज करें और आपातकालीन नंबर तैयार रखें।",
  "Checking conditions": "स्थितियों की जाँच की जा रही है",
  "High rainfall risk": "भारी वर्षा का जोखिम",
  "Elevated rainfall risk": "अधिक वर्षा का जोखिम",
  "Current model conditions": "वर्तमान मॉडल की स्थिति",
  "Weather source unavailable": "मौसम स्रोत अनुपलब्ध",
  "chance of rain today": "आज बारिश की संभावना",
  "forecast": "पूर्वानुमान",
  "Avoid low-lying routes and move early if local authorities advise.": "निचले मार्गों से बचें और यदि स्थानीय अधिकारी सलाह दें तो जल्दी चले जाएं।",
  "Keep monitoring local authority alerts before travelling.": "यात्रा करने से पहले स्थानीय अधिकारियों के अलर्ट पर नजर रखें।",
  "Live weather information is temporarily unavailable. Follow official local authority warnings and do not rely on this screen alone.": "लाइव मौसम की जानकारी अस्थायी रूप से अनुपलब्ध है। आधिकारिक स्थानीय चेतावनियों का पालन करें और केवल इस स्क्रीन पर निर्भर न रहें।",
  "Official river gauge": "आधिकारिक नदी गेज",
  "rising": "बढ़ रहा है",
  "falling": "घट रहा है",
  "steady": "स्थिर",
  "observed": "देखा गया",
  "Official source": "आधिकारिक स्रोत",
  "Weather model loading": "मौसम मॉडल लोड हो रहा है",
  "Official river-gauge data is temporarily unavailable.": "आधिकारिक नदी-गेज डेटा अस्थायी रूप से अनुपलब्ध है।",
  "Local alert": "स्थानीय अलर्ट",
  "loading": "लोड हो रहा है",
  "Profile & Operations Gateways": "प्रोफ़ाइल और संचालन गेटवे",
  "Assam Safety Network": "असम सुरक्षा नेटवर्क",
  "Citizen Account": "नागरिक खाता",
  "Tap to customize safety profile & emergency contacts": "सुरक्षा प्रोफ़ाइल और आपातकालीन संपर्कों को अनुकूलित करने के लिए टैप करें",
  "Hospital registration": "अस्पताल पंजीकरण",
  "Hospitals can request verified staff access and publish live resource information.": "अस्पताल सत्यापित कर्मचारियों की पहुंच का अनुरोध कर सकते हैं और लाइव संसाधन जानकारी प्रकाशित कर सकते हैं।",
  "Protected Operations App": "संरक्षित संचालन ऐप",
  "For authorized response teams": "अधिकृत प्रतिक्रिया टीमों के लिए",
  "Government": "सरकार",
  "Medical": "चिकित्सा",
  "Rescuer": "बचावकर्मी",
  "Your rescue flow": "आपकी बचाव स्थिति",
  "Saved on this device": "इस डिवाइस पर सहेजा गया",
  "No active SOS yet": "अभी कोई सक्रिय SOS नहीं",
  "When you activate SOS, your rescue flow will remain here—even after refresh.": "जब आप SOS सक्रिय करते हैं, तो आपकी बचाव स्थिति यहां रहेगी—रिफ्रेश करने के बाद भी।",
  "Go to SOS": "SOS पर जाएँ",
  "Updating rescue flow": "बचाव स्थिति अपडेट की जा रही है",
  "Live rescue flow": "लाइव बचाव स्थिति",
  "Tracking no.": "ट्रैकिंग नंबर",
  "Responder details will appear automatically after Command assigns the mission.": "कमांड द्वारा मिशन सौंपने के बाद रिस्पॉन्डर का विवरण अपने आप दिखाई देगा।",
  "Only your authorized account can add details or message the rescue team.": "केवल आपका अधिकृत खाता विवरण जोड़ सकता है या बचाव दल को संदेश भेज सकता है।",
  "Sign in with the reporting account to add details or message the rescue team.": "विवरण जोड़ने या बचाव दल को संदेश भेजने के लिए रिपोर्टिंग खाते से साइन इन करें।",
  "SOS received": "SOS प्राप्त हुआ",
  "Command is reviewing your location": "कमांड आपके स्थान की समीक्षा कर रहा है",
  "Rescuer assigned": "बचावकर्मी नियुक्त किया गया",
  "Your responder’s profile and live updates appear here": "आपके रिस्पॉन्डर की प्रोफ़ाइल और लाइव अपडेट यहां दिखाई देंगे",
  "Rescue completed": "बचाव कार्य पूरा हुआ",
  "This rescue flow is recorded on this device": "यह बचाव प्रवाह इस उपकरण पर दर्ज किया गया है",
  "Add more details": "अधिक विवरण जोड़ें",
  "People with you, help needed, and useful updates for responders.": "आपके साथ मौजूद लोग, आवश्यक सहायता, और बचाव दल के लिए उपयोगी अपडेट।"
}

hi_str = ", ".join([f'{json.dumps(k)}: {json.dumps(v)}' for k, v in translations.items()])

# Regex to find `hi: {\n    "Sign in to activate": ...\n  },`
# and we will inject into it.
pattern = r'(hi: \{\s*)(.*?)(\s*\}(,|$))'

def replacer(match):
    prefix = match.group(1)
    existing_content = match.group(2)
    suffix = match.group(3)
    new_content = existing_content + ", " + hi_str
    return prefix + new_content + suffix

new_content = re.sub(pattern, replacer, content, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Injected Hindi translations.")
