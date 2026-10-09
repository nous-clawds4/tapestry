// Test fixture, not compiled (relay-stream-gaps #2, ADR relay-stream-gaps/0002).
// StreamGroup::connOpen from strfry 1.1.0 src/apps/mesh/cmd_router.cpp, copied verbatim,
// laid out at its real path so patches/strfry-router/apply-patches.sh can take this
// directory as its strfry source dir. test/router-stream-limit-on-connect.test.js runs the
// script against a temp copy; this file itself is never modified.

        void connOpen(const std::string &url, uWS::WebSocket<uWS::CLIENT> *ws) {
            if (!conns.contains(url)) return;
            auto &c = conns.at(url);

            if (c.ws) {
                LI << "Already had open connection to " << url << ", closing";
                ws->close();
                return;
            }

            c.ws = ws;

            if (dir == "down" || dir == "both") {
                tao::json::value filterToSend = filter;
                filterToSend["limit"] = 0;

                auto msg = tao::json::to_string(tao::json::value::array({ "REQ", "X", filterToSend }));
                ws->send(msg.data(), msg.size(), uWS::OpCode::TEXT, nullptr, nullptr, true);
            }
        }
