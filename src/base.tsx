import React from "react";
import { NewFun, OpenFun, PromiseCallbackFn, RenderFun, BaseProps, OpenConfig } from "./types";
import { trapFocus } from "./utils";
import { CONTENT_ID, HEADER_ID } from "./const";
import { ComponentType } from "./enums";
import Animate from "./utils/animate";

const asyncWrap = (promise: Promise<any>): Promise<any> =>
  promise.then(res => res || true).catch(error => error || false);

const KEYCODE_ESC = 27;

const DEFAULTS = {
  closeOnEscape: true,
}

const MODAL_DEFAULTS_PROPS = {
  maskClosable: true,
}

const CONFIRM_DEFAULTS_PROPS = {
  maskClosable: false,
}

export interface State {
  visible: boolean;
}

export default class Popup extends React.Component<
  BaseProps,
  State
  > {
  promise: null | Promise<any> = null;
  reject: PromiseCallbackFn | null = null;
  resolve: PromiseCallbackFn | null = null;

  dynamicConfig: OpenConfig | null = null;

  myRef = React.createRef();

  removeFocusListener: Function | null;

  resolved: any = {
    hasResolved: true,
    value: void 0
  };

  state = {
    visible: false
  };

  static new: NewFun;

  static render: RenderFun

  componentDidMount() {
    document.addEventListener('keyup', this.handleEscape);
  }

  componentWillMount() {
    document.removeEventListener('keyup', this.handleEscape);
  }

  render() {
    const { popupStyle, wrapClassName, aria, transitionAnimationClasses } = this.allProps;
    const { visible } = this.state;
    const { labelledby = HEADER_ID, describedby = CONTENT_ID } = aria || {};
    const styles = this.styles
    const role = this.props.type === ComponentType.Confirm ? 'alertdialog' : 'dialog';
    const defaultAnimationClasses = {
      beforeEnter: styles.beforeEnter,
      enter: styles.enter,
      active: styles.active,
      exit: styles.exit
    }

    const animationClasses = transitionAnimationClasses ? transitionAnimationClasses : defaultAnimationClasses;

    return (
      <Animate
        show={visible}
        classNames={animationClasses}
        timeout={100}
        onEnter={this.onVisible}
        onExit={this.handleModalExit}>
        <div
          className={`${styles.popupContainer}${wrapClassName ? wrapClassName : ''}`}
          onClick={this.handleMaskClick}
          //@ts-ignore
          ref={this.myRef}>
          <div
            role={role}
            aria-modal="true"
            aria-labelledby={labelledby}
            aria-describedby={describedby}
            className={styles.container}
            style={popupStyle || {}} >
            {this.renderCloseButton(styles)}
            {this.renderHeader(styles)}
            {this.renderContent(styles)}
            {this.renderFooter(styles)}
          </div>
        </div>
      </Animate>
    );
  }

  get allProps() {
    const componentDefaults = this.props.type === ComponentType.Confirm ? CONFIRM_DEFAULTS_PROPS : MODAL_DEFAULTS_PROPS;
    return { ...DEFAULTS, ...componentDefaults, ...this.props, ...(this.dynamicConfig || {}) };
  }

  renderHeader(styles: any) {
    const { title } = this.allProps;
    if (!title) {
      return null
    }

    // some screen reader read text from text container elments only so use it
    if (typeof title !== 'object' || typeof title !== 'function') {
      return (
        <div className={styles.titleContainer}>
          <h3 className={styles.title} id={HEADER_ID}>{title}</h3>
        </div>
      )
    }

    return (
      <div className={styles.titleContainer} id={HEADER_ID}>
        {title}
      </div>
    )
  }

  renderCloseButton(styles: any) {
    const { type, closable } = this.allProps;
    const isModal = type === ComponentType.Modal;
    if (!isModal || closable === false) {
      return null
    }
    return (
      <div className={styles.closeButtonContainer}>
        <CloseIcon className={styles.closeButton} onClick={this.handleCancel} />
      </div>
    );
  }


  renderContent(styles: any) {
    const { content } = this.allProps;
    if (content === null) return null;
    let contentToRender = this.getRenderableWithProps(content);
    return contentToRender ? <div id={CONTENT_ID} className={styles.content}>{contentToRender}</div> : null;
  }

  renderFooter(styles: any) {
    const { footer, okText, cancelText, closable } = this.allProps;

    if (footer === null) return null;

    let contentToRender = this.getRenderableWithProps(footer);

    if (contentToRender !== undefined) {
      return <div className={styles.footer}>{contentToRender}</div>;
    }

    return (
      <div className={styles.footer}>
        {closable !== false && <button className={styles.action} onClick={this.handleCancel}>
          {cancelText || 'Cancel'}
        </button>}
        <button className={styles.action} onClick={this.handleOK}>
          {okText || 'Ok'}
        </button>
      </div>
    );
  }

  get styles() {
    return {} as any
  }

  handleEscape = (event: KeyboardEvent) => {
    const key = event.which || event.keyCode;
    const { closeOnEscape, closable } = this.allProps
    if ((closable !== false || closeOnEscape !== false) && key === KEYCODE_ESC) {
      this.onCancel();
      event.stopPropagation();
    }
  };

  getRenderableWithProps(component: any) {
    let contentToRender;
    const props = { cancel: this.onCancel, ok: this.onOk };
    if (component === null) return null;
    if (component && typeof component === "function") {
      contentToRender = component(props);
    } else if (React.isValidElement(component)) {
      contentToRender = React.cloneElement(component, props)
    } else {
      contentToRender = component;
    }

    return contentToRender;
  }

  open: OpenFun = (dynamicProps?: OpenConfig) => {
    this.dynamicConfig = null;
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    if (dynamicProps) {
      this.dynamicConfig = dynamicProps;
    }
    this.setState({ visible: true });
    return asyncWrap(this.promise);
  };

  onVisible = () => {
    this.disableBodyScroll();
    this.removeFocusListener = trapFocus(this.myRef.current)
  }

  afterAction = () => {
    this.dynamicConfig = null;
    this.promise = null;
    this.resolve = null;
    this.reject = null;
    this.enableBodyScroll();
    this.removeFocusListener && this.removeFocusListener();
    this.removeFocusListener = null;
  };

  handleMaskClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const { maskClosable, closable } = this.allProps;
    if (closable === false) return
    if (maskClosable !== false && this.myRef.current === e.target) {
      this.onCancel();
    }
  }

  handleModalExit = () => {
    if (this.resolved.hasResolved == true) {
      this.resolve && this.resolve(this.resolved.value);
    } else {
      this.reject && this.reject(this.resolved.value);
    }
    this.afterAction();
  }

  onOk = (value: any = true) => {
    this.setState(
      {
        visible: false
      },
      () => {
        this.resolved = {
          hasResolved: true,
          value,
        };
      }
    );
  };

  onCancel = (value: any = false) => {
    this.setState(
      {
        visible: false
      },
      () => {
        this.resolved = {
          hasResolved: false,
          value,
        };
      }
    );
  };

  handleOK = () => {
    this.onOk(true)
  }

  handleCancel = () => {
    this.onCancel(false)
  }

  disableBodyScroll() {
    let { body } = window.document;
    body.style.overflow = "hidden";
  }

  enableBodyScroll() {
    let { body } = window.document;
    body.style.overflow = "";
  }
}

interface CloseIcon {
  onClick: any;
  className: string;
}

const CloseIcon = ({ onClick, className }: CloseIcon) => {
  return (
    <button aria-label="close" onClick={onClick} className={className} >
      <svg fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
    </button>
  );
}