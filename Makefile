MDN_REPO=https://github.com/mdn/content.git
GRIP=grip
GIT=git
NODE=node
YARN=yarn
EGREP=egrep
SED=sed
NETSTAT=netstat
SHELL:=/bin/bash
WPTFYI=https://wpt.fyi/results

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
	echo " <span>•</span> | Spec shortname | # MDN articles" >> $<.tmp
	echo " -------------- | :------------- | --------------:" >> $<.tmp
	for file in *.json; do \
		shortname=$${file%.*}; \
		specURL=$$(jq -r "to_entries | map(select(.value == \"$$file\") | .key)[0]" SPECMAP.json); \
		if [[ $$specURL == *"whatwg.org"* ]]; then \
			source="WHATWG"; \
			image="SITE/whatwg.png"; \
		elif [[ $$specURL == *"webrtc"* ]]; then \
			source="W3C"; \
			image="SITE/webrtc.png"; \
		elif [[ $$specURL == *"httpwg.org"* ]]; then \
			source="HTTPWG"; \
			image="SITE/httpwg.png"; \
		elif [[ $$specURL == *"www.rfc-editor.org"* ]]; then \
			source="IETF"; \
			image="SITE/ietf.png"; \
		elif [[ $$specURL == *"datatracker.ietf.org"* ]]; then \
			source="IETF"; \
			image="SITE/ietf.png"; \
		elif [[ $$specURL == *"tc39"* ]]; then \
			source="TC39"; \
			image="SITE/tc39.png"; \
		elif [[ $$specURL == *"khronos.org"* ]]; then \
			source="Khronos"; \
			image="SITE/khronos.png"; \
		elif [[ $$specURL == *"sourcemaps.info"* ]]; then \
			source="Other"; \
			image="SITE/sourcemaps.png"; \
		elif [[ $$specURL == *"immersive-web.github.io"* ]]; then \
			source="W3C"; \
			image="SITE/webxr.png"; \
		elif [[ $$specURL == *"wicg.github.io"* ]]; then \
			source="WICG"; \
			image="SITE/wicg.png"; \
		elif [[ $$specURL == *"drafts.csswg.org"* ]]; then \
			source="W3C"; \
			image="SITE/css.png"; \
		elif [[ $$specURL == *"drafts.fxtf.org"* ]]; then \
			source="W3C"; \
			image="SITE/css.png"; \
		elif [[ $$specURL == *"drafts.css-houdini.org"* ]]; then \
			source="W3C"; \
			image="SITE/css.png"; \
		elif [[ $$specURL == *"svgwg.org"* ]]; then \
			source="W3C"; \
			image="SITE/svg.png"; \
		elif [[ $$specURL == *"privacycg.github.io"* ]]; then \
			source="W3C"; \
			image="SITE/w3.png"; \
		elif [[ $$specURL == *"webassembly.github.io"* ]]; then \
			source="W3C"; \
			image="SITE/wasm.png"; \
		elif [[ $$specURL == *"webaudio.github.io"* ]]; then \
			source="W3C"; \
			image="SITE/w3.png"; \
		elif [[ $$specURL == *"webbluetoothcg.github.io"* ]]; then \
			source="W3C"; \
			image="SITE/w3.png"; \
		elif [[ $$specURL == *"w3c.github.io"* ]]; then \
			source="W3C"; \
			image="SITE/w3.png"; \
		elif [[ $$specURL == *"www.w3.org"* ]]; then \
			source="W3C"; \
			image="SITE/w3.png"; \
		fi; \
		count=$$(jq length $$file); \
		if [[ "$$file" != "SPECMAP.json" \
			&& "$$file" != "SPECURLS.json" && "$$file" != "w3c.json" && "$$file" != "package.json" ]]; then \
			echo -n "![$$image]($$image)<span>$$image</span>" >> $<.tmp; \
			echo -n " |	[$${file%.*}]($$specURL)" >> $<.tmp; \
			if [ $$shortname = "background-sync" ]; then \
				shortname="BackgroundSync"; \
			elif [ $$shortname = "battery-status" ]; then \
				shortname="battery"; \
			elif [ $$shortname = "contact-api" ]; then \
				shortname="contacts"; \
			elif [ $$shortname = "csp-embedded-enforcement" ]; then \
				shortname="content-security-policy/embedded-enforcement"; \
			elif [ $$shortname = "csp" ]; then \
				shortname="content-security-policy"; \
			elif [ $$shortname = "dom-parsing" ]; then \
				shortname="domparsing"; \
			elif [ $$shortname = "eyedropper-api" ]; then \
				shortname="eyedropper"; \
			elif [ $$shortname = "fetch-metadata" ]; then \
				shortname="fetch/metadata"; \
			elif [ $$shortname = "fileapi" ]; then \
				shortname="FileAPI"; \
			elif [ $$shortname = "file-system" ]; then \
				shortname="fs"; \
			elif [ $$shortname = "gamepad-extensions" ]; then \
				shortname="gamepad"; \
			elif [ $$shortname = "geolocation-api" ]; then \
				shortname="geolocation-API"; \
			elif [ $$shortname = "image-capture" ]; then \
				shortname="mediacapture-image"; \
			elif [ $$shortname = "indexeddb" ]; then \
				shortname="IndexedDB"; \
			elif [ $$shortname = "longtasks" ]; then \
				shortname="longtask-timing"; \
			elif [ $$shortname = "mediacapture-screen-share" ]; then \
				shortname="screen-capture"; \
			elif [ $$shortname = "mediacapture-transform" ]; then \
				shortname="mediacapture-insertable-streams"; \
			elif [ $$shortname = "mediastream-recording" ]; then \
				shortname="mediacapture-record"; \
			elif [ $$shortname = "sanitizer" ]; then \
				shortname="sanitizer-api"; \
			elif [ $$shortname = "scheduling-apis" ]; then \
				shortname="scheduler"; \
			elif [[ $$shortname == *"selectors"* ]]; then \
				shortname="css/selectors"; \
			elif [ $$shortname = "shape-detection-api" ]; then \
				shortname="shape-detection"; \
			elif [ $$shortname = "storage-access" ]; then \
				shortname="storage-access-api"; \
			elif [ $$shortname = "svg-animations" ]; then \
				shortname="svg/animations"; \
			elif [ $$shortname = "wasm-js-api" ]; then \
				shortname="wasm/jsapi"; \
			elif [ $$shortname = "wasm-web-embedding" ]; then \
				shortname="wasm/webapi"; \
			elif [[ $$shortname == *"web-animations"* ]]; then \
				shortname="web-animations"; \
			elif [ $$shortname = "web-bluetooth" ]; then \
				shortname="bluetooth"; \
			elif [ $$shortname = "webcrypto" ]; then \
				shortname="WebCryptoAPI"; \
			elif [[ $$shortname == *"webgl"* ]]; then \
				shortname="webgl"; \
			elif [ $$shortname = "webxr-anchors" ]; then \
				shortname="webxr/anchors"; \
			elif [ $$shortname = "webxr-ar" ]; then \
				shortname="webxr/ar-module"; \
			elif [ $$shortname = "webxr-depth-sensing" ]; then \
				shortname="webxr/depth-sensing"; \
			elif [ $$shortname = "webxr-dom-overlays" ]; then \
				shortname="webxr/dom-overlay"; \
			elif [ $$shortname = "webxr-gamepads" ]; then \
				shortname="webxr/gamepads-module"; \
			elif [ $$shortname = "webxr-hit-test" ]; then \
				shortname="webxr/hit-test"; \
			elif [ $$shortname = "webxr-layers" ]; then \
				shortname="webxr/layers"; \
			elif [ $$shortname = "webxr-lighting-estimation" ]; then \
				shortname="webxr/light-estimation"; \
			elif [ $$shortname = "woff2" ]; then \
				shortname="css/WOFF2"; \
			elif [[ $$specURL == *"drafts.csswg.org"* \
				|| $$specURL == *"drafts.css-houdini.org"* \
				|| $$specURL == *"drafts.fxtf.org"* ]]; then \
				if [ $$shortname = "scroll-animations" ]; then \
					shortname="scroll-animations"; \
				elif [ $$shortname = "css2" ]; then \
					shortname="css/CSS2"; \
				elif [ $$shortname = "cssom" ]; then \
					shortname="css/cssom"; \
				elif [ $$shortname = "cssom-view" ]; then \
					shortname="css/cssom-view"; \
				elif [ $$shortname = "css-mediaqueries" ]; then \
					shortname="css/mediaqueries"; \
				elif [ $$shortname = "mediaqueries-5" ]; then \
					shortname="css/mediaqueries"; \
				elif [ $$shortname = "css-overscroll" ]; then \
					shortname="css/overscroll-behavior"; \
				elif [[ $$shortname =~ -[1-9] ]]; then \
					shortname="css/$${shortname%??}"; \
				else \
					shortname="css/$$shortname"; \
				fi; \
			fi; \
			if \
				[[ $$shortname != *"appmanifest"* ]] \
				&& [[ $$shortname != *"aria"* ]] \
				&& [[ $$shortname != *"controls-list"* ]] \
				&& [[ $$shortname != *"crash-reporting"* ]] \
				&& [[ $$shortname != *"css-regions"* ]] \
				&& [[ $$shortname != *"css-rhythm"* ]] \
				&& [[ $$shortname != *"manifest-app-info"* ]] \
				&& [[ $$shortname != *"manifest-incubations"* ]] \
				&& [[ $$shortname != *"sourcemaps"* ]] \
				&& [[ $$shortname != *"wasm-exception-handling"* ]] \
				&& [[ $$shortname != *"window-controls-overlay"* ]] \
				&& [ $$shortname != "woff" ] \
				&& [[ $$specURL != *"httpwg.org"* ]] \
				&& [[ $$specURL != *"www.rfc-editor.org"* ]] \
				&& [[ $$specURL != *"datatracker.ietf.org"* ]] \
				&& [[ $$specURL != *"tc39.es"* ]] \
			; then \
				echo -n " [Ⓣ]($(WPTFYI)/$$shortname)" >> $<.tmp; \
			fi; \
			echo -n " [Ⓢ](less-than-2.html?spec=$${file%.*})" >> $<.tmp; \
			echo -n " [Ⓓ]($$file)" >> $<.tmp; \
			echo -n " | $$count" >> $<.tmp; \
			echo    " | $$source" >> $<.tmp; \
			>> $<.tmp; \
		fi; \
	done
	$(GRIP) --title=$< --export $<.tmp - > $@
	$(SED) -i .bak "s/<head>/<head>\n  <link rel=stylesheet href=SITE\/sortable.min.css>/" $@; \
	$(SED) -i .bak "s/<head>/<head>\n  <script src=SITE\/sortable.min.js><\/script>/" $@; \
	$(SED) -i .bak "s/<head>/<head>\n  <style>.hidden { opacity: 0; font-size: 0px; } img { padding-top: 8px; }<\/style>/" $@; \
	$(SED) -i .bak "s/<span>/<span class=hidden>/" $@; \
	$(SED) -i .bak "s/<table>/<table>\n<caption>Ⓣ = tests • Ⓢ = status (implementations) • Ⓓ = data (JSON)<\/caption>/" $@; \
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
