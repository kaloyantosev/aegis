import urllib.request
import urllib.parse
import json

sql = "SELECT date, count(*) as count FROM option_chain WHERE act_symbol='SPY' GROUP BY date ORDER BY date DESC LIMIT 20;"
url = 'https://www.dolthub.com/api/v1alpha1/post-no-preference/options?q=' + urllib.parse.quote(sql)

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print("Success!")
        print(json.dumps(data, indent=2))
except Exception as e:
    print("Error:", e)
