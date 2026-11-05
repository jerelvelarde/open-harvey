// If anything below it throws while rendering, show what happened and a Reset demo button, instead
// of a blank page. A crash must never hide the way out.

"use client";

import { Component, type ReactNode } from "react";
import { Button, Card } from "@/components/ui/Card";
import { resetDemo } from "@/lib/store";

type Props = { children: ReactNode; className?: string };

export class ResetBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[legal] The workspace crashed:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={this.props.className}>
        <Card title="Something broke while drawing this panel" meta={this.state.error.message}>
          <p className="text-muted">Reset the demo to clear the saved reviews, approvals and published rules, and start clean.</p>
          <Button variant="primary" className="mt-3" onClick={() => resetDemo()}>
            Reset demo
          </Button>
        </Card>
      </div>
    );
  }
}
