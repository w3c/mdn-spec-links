BCD_REPO=https://github.com/mdn/browser-compat-data.git
MDN_REPO=https://github.com/mdn/content.git
GRIP=grip
GIT=git
NODE=node
YARN=yarn
EGREP=egrep
SED=sed
NETSTAT=netstat
SHELL:=/bin/bash

.PHONY: report-only report report-BCD

all: report

yarn.lock:
	$(YARN)

browser-compat-data:
	$(GIT) clone $(BCD_REPO)

content:
	$(GIT) clone $(MDN_REPO)
	$(YARN) --cwd content

yari.PID: content
	@if ! ($(NETSTAT) -an | $(EGREP) -i "[.:]5042.+LISTEN" > /dev/null); \
		then \
		$(YARN) --cwd content start & echo $$! > yari.PID; \
		sleep 3; \
		echo "yari PID: $$(cat yari.PID)"; \
	fi

BCD-LOG: yarn.lock browser-compat-data
	$(NODE) .spec-urls-check.js 2>&1 \
	  | tee $@

report-BCD: BCD-LOG
	@! $(EGREP) "bad fragment" BCD-LOG
	@! $(EGREP) "needs spec URL" BCD-LOG

LOG: report-BCD yari.PID
	$(NODE) .browser-compat-data-process.js 2>&1 \
	  | tee $@

report: LOG
	@# BCD-LOG errors
	@! $(EGREP) "bad fragment" BCD-LOG
	@! $(EGREP) "needs spec URL" BCD-LOG
	@# LOG errors
	@! $(EGREP) "error for" LOG
	@! $(EGREP) "broken spec URL" LOG
	@! $(EGREP) "has bad spec URL" LOG
	@! $(EGREP) "unexpected status code" LOG
	@# LOG warnings
	@! $(EGREP) "odd MDN URL" LOG || true
	@! $(EGREP) "bad caniuse spec URL" LOG || true

report-only:
	@! $(EGREP) "bad fragment" BCD-LOG 2>/dev/null || true
	@! $(EGREP) "needs spec URL" BCD-LOG 2>/dev/null || true
	@! $(EGREP) "error for" LOG 2>/dev/null || true
	@! $(EGREP) "broken spec URL" LOG 2>/dev/null || true
	@! $(EGREP) "has bad spec URL" LOG 2>/dev/null || true
	@! $(EGREP) "unexpected status code" LOG 2>/dev/null || true
	@! $(EGREP) "odd MDN URL" LOG 2>/dev/null || true
	@! $(EGREP) "bad caniuse spec URL" LOG 2>/dev/null || true

URLS-LOG: yarn.lock
	$(NODE) --max-old-space-size=13312 .spec-urls-make.js 2>&1 \
	  | tee URLS-LOG

index.html: README.md
	cp $< $<.tmp
	echo >> $<.tmp
	echo >> $<.tmp
	echo "Spec shortname, status, and data | MDN articles | Source" >> $<.tmp
	echo ":------------------------------- | ------------:| -----:" >> $<.tmp
	for file in *.json; do \
		specURL=$$(jq -r "to_entries | map(select(.value == \"$$file\") | .key)[0]" SPECMAP.json); \
		if [[ $$specURL == *"whatwg.org"* ]]; then \
			source="WHATWG"; \
		elif [[ $$specURL == *"w3c.github.io"* ]]; then \
			source="W3C"; \
		elif [[ $$specURL == *"www.w3.org"* ]]; then \
			source="W3C"; \
		elif [[ $$specURL == *"httpwg.org"* ]]; then \
			source="HTTPWG"; \
		elif [[ $$specURL == *"www.rfc-editor.org"* ]]; then \
			source="IETF"; \
		elif [[ $$specURL == *"datatracker.ietf.org"* ]]; then \
			source="IETF"; \
		elif [[ $$specURL == *"tc39"* ]]; then \
			source="TC39"; \
		elif [[ $$specURL == *"www.khronos.org"* ]]; then \
			source="Khronos"; \
		elif [[ $$specURL == *"wicg.github.io"* ]]; then \
			source="WICG"; \
		elif [[ $$specURL == *"drafts.csswg.org"* ]]; then \
			source="W3C"; \
		elif [[ $$specURL == *"drafts.fxtf.org"* ]]; then \
			source="W3C"; \
		elif [[ $$specURL == *"drafts.css-houdini.org"* ]]; then \
			source="W3C"; \
		elif [[ $$specURL == *"svgwg.org"* ]]; then \
			source="W3C"; \
		elif [[ $$specURL == *"immersive-web.github.io"* ]]; then \
			source="W3C"; \
		elif [[ $$specURL == *"privacycg.github.io"* ]]; then \
			source="W3C"; \
		elif [[ $$specURL == *"webassembly.github.io"* ]]; then \
			source="W3C"; \
		elif [[ $$specURL == *"webaudio.github.io"* ]]; then \
			source="W3C"; \
		elif [[ $$specURL == *"webbluetoothcg.github.io"* ]]; then \
			source="W3C"; \
		else \
			source="Other"; \
		fi; \
		count=$$(jq length $$file); \
		if [[ "$$file" != "SPECMAP.json" \
		&& "$$file" != "SPECURLS.json" && "$$file" != "w3c.json" && "$$file" != "package.json" ]]; then \
		echo "[$${file%.*}]($$specURL) [[status](less-than-2.html?spec=$${file%.*})] [[data]($$file)] | $$count | $$source" >> $<.tmp; \
		fi; \
	done
	$(GRIP) --title=$< --export $<.tmp - > $@
	$(SED) -i .bak "s/<head>/<head>\n  <link rel=stylesheet href=SITE\/sortable.min.css>/" $@; \
	$(SED) -i .bak "s/<head>/<head>\n  <script src=SITE\/sortable.min.js><\/script>/" $@; \
	$(SED) -i .bak "s/<table>/<table class=sortable>/" $@; \
	$(RM) $@.bak
	$(RM) $<.tmp

.mdn-spec-links.schema.json: .mdn-spec-links.ts
	ts-json-schema-generator --path $< --unstable --type MDNSpecLink --out $@

clean:
	$(RM) LOG
	$(RM) BCD-LOG
	$(RM) URLS-LOG
	if [ -a yari.PID ]; then kill -- -$$(ps -o pgid= $$(cat yari.PID)) \
		|| true; fi;
	$(RM) yari.PID

unsafe-dangerously-and-destructively-clean: clean
	$(RM) yarn.lock
	$(RM) -r browser-compat-data
	$(RM) -r content
