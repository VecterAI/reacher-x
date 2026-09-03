type ConvexConnectionStateClient = {
  connectionState: () => {
    hasInflightRequests: boolean;
  };
};

type DocumentLocation = {
  assign: (href: string) => void;
};

type DocumentForm = {
  checkValidity: () => boolean;
  noValidate: boolean;
  requestSubmit: () => void;
};

type ScheduleReset = (reset: () => void) => void;

type BeforeUnloadTarget = {
  addEventListener: (
    type: "beforeunload",
    listener: (event: BeforeUnloadEvent) => void
  ) => void;
};

const INTENTIONAL_NAVIGATION_RESET_MS = 5_000;
const installedTargets = new WeakSet<object>();

export function createIntentionalDocumentNavigationController() {
  let intentionalNavigationPending = false;

  return {
    navigate(
      href: string,
      location: DocumentLocation,
      scheduleReset: ScheduleReset
    ) {
      intentionalNavigationPending = true;

      try {
        location.assign(href);
      } catch (error) {
        intentionalNavigationPending = false;
        throw error;
      }

      scheduleReset(() => {
        intentionalNavigationPending = false;
      });
    },
    submit(form: DocumentForm, scheduleReset: ScheduleReset) {
      if (!form.noValidate && !form.checkValidity()) {
        return;
      }

      intentionalNavigationPending = true;

      try {
        form.requestSubmit();
      } catch (error) {
        intentionalNavigationPending = false;
        throw error;
      }

      scheduleReset(() => {
        intentionalNavigationPending = false;
      });
    },
    shouldWarnBeforeUnload(hasInflightRequests: boolean): boolean {
      if (intentionalNavigationPending) {
        intentionalNavigationPending = false;
        return false;
      }

      return hasInflightRequests;
    },
  };
}

const intentionalNavigationController =
  createIntentionalDocumentNavigationController();

export function navigateDocumentIntentionally(href: string): void {
  intentionalNavigationController.navigate(href, window.location, (reset) => {
    window.setTimeout(reset, INTENTIONAL_NAVIGATION_RESET_MS);
  });
}

export function submitDocumentFormIntentionally(form: HTMLFormElement): void {
  intentionalNavigationController.submit(form, (reset) => {
    window.setTimeout(reset, INTENTIONAL_NAVIGATION_RESET_MS);
  });
}

export function installConvexUnsavedChangesWarning(
  client: ConvexConnectionStateClient,
  target: BeforeUnloadTarget
): void {
  if (installedTargets.has(target)) {
    return;
  }
  installedTargets.add(target);

  target.addEventListener("beforeunload", (event) => {
    const shouldWarn = intentionalNavigationController.shouldWarnBeforeUnload(
      client.connectionState().hasInflightRequests
    );
    if (!shouldWarn) {
      return;
    }

    event.preventDefault();
    event.returnValue = "";
  });
}
