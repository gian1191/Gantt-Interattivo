#!/bin/bash
# Riallinea tests/cpm.js e tests/layout.js ai blocchi CORE dell'applicazione.
# Da eseguire dopo ogni modifica a CPM CORE o LAYOUT CORE dentro l'HTML.
set -e
cd "$(dirname "$0")"
python3 - << 'PY'
app = open('pianificatore.html').read()
def blocco(nome, exports):
    a = app.index('/* ============================================================\n   ' + nome + ' CORE START')
    b = app.index('/* ' + nome + ' CORE END */')
    return app[a:b] + '/* ' + nome + ' CORE END */\n\nmodule.exports = ' + exports + ';\n'
open('tests/cpm.js','w').write(blocco('CPM',
  '{ makeCalendar, topoSort, computeCPM, simulate, esFromLink, lfFromLink }'))
open('tests/layout.js','w').write(blocco('LAYOUT',
  '{ assignRanks, orderWithinLayers, countCrossings, layoutNetwork, edgePath }'))
print('core sincronizzati')
PY
cd tests && node test_cpm.js | tail -1 && node test_layout.js | tail -1 && node test_app.js | tail -1
cd .. && node tests/test_e2e.js | tail -1
