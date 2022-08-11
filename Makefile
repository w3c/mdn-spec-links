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
	echo "Spec shortname and status | MDN articles | Spec URL" >> $<.tmp
	echo ":------------------------ | -----------: | :-------" >> $<.tmp
	for file in *.json; do \
		specURL=$$(jq -r "to_entries | map(select(.value == \"$$file\") | .key)[0]" SPECMAP.json); \
		count=$$(jq length $$file); \
		if [[ "$$file" != "SPECMAP.json" \
		&& "$$file" != "SPECURLS.json" && "$$file" != "w3c.json" && "$$file" != "package.json" ]]; then \
		echo "[$${file%.*}]($$file) [[status](less-than-2.html?spec=$${file%.*})] | $$count | $$specURL" >> $<.tmp; \
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
