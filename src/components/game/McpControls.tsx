import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { useGame } from "../../store/game";
import { useGameSession } from "./gameSession";
import { useAutopilotSession } from "./autopilotSession";
import { useShopController } from "../../hooks/useShopController";
import { useOpenedPackPicker } from "../../hooks/useOpenedPackPicker";
import { useConsumableActions } from "../../hooks/useConsumableActions";
import { useGameModals } from "../../hooks/useGameModals";
import { GameController, type GameCommands } from "../../mcp/controller";
import { isToolName } from "../../mcp/protocol";
import { Button } from "../ui/Button";

function BrowserBridge() {
  const { t } = useTranslation();
  const session = useGameSession();
  const shop = useShopController();
  const { pickFromOpenedPack } = useOpenedPackPicker();
  const { useConsumable } = useConsumableActions();
  const { dismissRoundWon } = useGameModals(session.startNewGame);
  const commands = useRef<GameCommands>({
    session,
    shop,
    pickFromOpenedPack,
    useConsumable,
    dismissRoundWon,
  });
  const controller = useRef<GameController | null>(null);
  const publish = useRef<() => void>(() => {});
  const [status, setStatus] = useState("connecting");
  const [sessionId, setSessionId] = useState("");
  useLayoutEffect(() => {
    commands.current = {
      session,
      shop,
      pickFromOpenedPack,
      useConsumable,
      dismissRoundWon,
    };
  });
  useLayoutEffect(() => {
    controller.current?.changed();
    publish.current();
  }, [session.isScoring]);

  useEffect(() => {
    const game = new GameController(
      () => useGame.getState(),
      () => commands.current,
      (action) => flushSync(action),
    );
    controller.current = game;
    let socket: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let update: ReturnType<typeof setTimeout> | undefined;
    const sendState = () => {
      clearTimeout(update);
      update = setTimeout(() => {
        if (!closed && socket?.readyState === WebSocket.OPEN && game.sessionId)
          socket.send(JSON.stringify({ type: "state", state: game.observe() }));
      }, 0);
    };
    publish.current = sendState;
    const unsubscribe = useGame.subscribe(() => {
      game.changed();
      sendState();
    });
    const connect = () => {
      if (closed) return;
      setStatus("connecting");
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/mcp/game`,
      );
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as {
            type?: string;
            sessionId?: string;
            requestId?: string;
            tool?: string;
            args?: unknown;
          };
          if (message.type === "connected" && message.sessionId) {
            game.sessionId = message.sessionId;
            game.changed();
            setSessionId(message.sessionId);
            setStatus("connected");
            sendState();
          }
          if (
            message.type === "call" &&
            message.tool &&
            isToolName(message.tool) &&
            message.requestId
          ) {
            const result = game.call(message.tool, message.args);
            socket?.send(
              JSON.stringify({
                type: "result",
                requestId: message.requestId,
                result,
              }),
            );
            sendState();
          }
        } catch {
          setStatus("error");
          socket?.close();
        }
      };
      socket.onclose = () => {
        if (closed) return;
        game.sessionId = "";
        setSessionId("");
        setStatus("error");
        retry = setTimeout(connect, 3000);
      };
      socket.onerror = () => setStatus("error");
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      clearTimeout(update);
      unsubscribe();
      publish.current = () => {};
      controller.current = null;
      if (socket) {
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      }
    };
  }, []);

  return (
    <div className="space-y-1 text-xs text-muted" role="status">
      <p>
        {status === "connected"
          ? t("mcp.connected")
          : status === "connecting"
            ? t("mcp.connecting")
            : t("mcp.error")}
      </p>
      {sessionId && (
        <p className="font-mono" title={sessionId}>
          {t("mcp.session", { id: sessionId.slice(0, 8) })}
        </p>
      )}
    </div>
  );
}

export default function McpControls() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const autopilot = useAutopilotSession();
  return createPortal(
    <aside
      className="fixed top-2 right-2 z-[150] flex max-w-64 flex-col gap-2 rounded-lg border border-border bg-surface p-3 text-ink shadow-lg"
      aria-label={t("mcp.title")}
      data-testid="mcp-controls"
    >
      <Button
        variant="advisor"
        size="sm"
        aria-pressed={enabled}
        onClick={() => {
          if (!enabled) autopilot?.autopilot.stop();
          setEnabled(!enabled);
        }}
      >
        {enabled ? t("mcp.disconnect") : t("mcp.enable")}
      </Button>
      {enabled && <BrowserBridge />}
    </aside>,
    document.body,
  );
}
