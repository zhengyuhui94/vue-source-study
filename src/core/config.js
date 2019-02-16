/* @flow */

import {
  no,
  noop,
  identity
} from 'shared/util'

import { LIFECYCLE_HOOKS } from 'shared/constants'

export type Config = {
  // user
  optionMergeStrategies: { [key: string]: Function };
  silent: boolean;
  productionTip: boolean;
  performance: boolean;
  devtools: boolean;
  errorHandler: ?(err: Error, vm: Component, info: string) => void;
  warnHandler: ?(msg: string, vm: Component, trace: string) => void;
  ignoredElements: Array<string | RegExp>;
  keyCodes: { [key: string]: number | Array<number> };

  // platform
  isReservedTag: (x?: string) => boolean;
  isReservedAttr: (x?: string) => boolean;
  parsePlatformTagName: (x: string) => string;
  isUnknownElement: (x?: string) => boolean;
  getTagNamespace: (x?: string) => string | void;
  mustUseProp: (tag: string, type: ?string, name: string) => boolean;

  // private
  async: boolean;

  // legacy
  _lifecycleHooks: Array<string>;
};

export default ({
  /**
   * Option merge strategies (used in core/util/options)
   * 选项合并策略(在core/util/options中使用)
   */
  // $flow-disable-line
  optionMergeStrategies: Object.create(null),

  /**
   * Whether to suppress warnings.
   * 是否开启日志和警告。
   */
  silent: false,

  /**
   * Show production mode tip message on boot?
   * 在引导时显示生产模式提示消息?
   */
  productionTip: process.env.NODE_ENV !== 'production',

  /**
   * Whether to enable devtools
   * 是否启用开发者工具
   */
  devtools: process.env.NODE_ENV !== 'production',

  /**
   * Whether to record perf
   * 是否记录性能
   */
  performance: false,

  /**
   * Error handler for watcher errors
   * 监视程序错误的错误处理程序（开发者环境下生效，在生产环境下它会被忽略。）
   */
  errorHandler: null,

  /**
   * Warn handler for watcher warns
   * 警告处理程序的观察者警告
   */
  warnHandler: null,

  /**
   * Ignore certain custom elements
   * 忽略某些定制元素
   */
  ignoredElements: [],

  /**
   * Custom user key aliases for v-on
   * 自定义用户键别名的v-on
   */
  // $flow-disable-line
  keyCodes: Object.create(null),

  /**
   * Check if a tag is reserved so that it cannot be registered as a
   * component. This is platform-dependent and may be overwritten.
   * 检查标记是否保留，以便不能将其注册为组件
   * 这依赖于平台，可能会被覆盖。
   */
  isReservedTag: no,

  /**
   * Check if an attribute is reserved so that it cannot be used as a component
   * prop. This is platform-dependent and may be overwritten.
   * 检查属性是否保留，以便不能将其用作组件支柱。
   * 这依赖于平台，可能会被覆盖。
   */
  isReservedAttr: no,

  /**
   * Check if a tag is an unknown element.
   * Platform-dependent.
   * 检查标记是否是未知元素。
   * 平台相关的。
   */
  isUnknownElement: no,

  /**
   * Get the namespace of an element
   * 获取元素的名称空间
   */
  getTagNamespace: noop,

  /**
   * Parse the real tag name for the specific platform.
   * 解析特定平台的实际标记名称。
   */
  parsePlatformTagName: identity,

  /**
   * Check if an attribute must be bound using property, e.g. value
   * Platform-dependent.
   * 检查是否必须使用属性(例如value)绑定属性
   * 平台相关的。
   */
  mustUseProp: no,

  /**
   * Perform updates asynchronously. Intended to be used by Vue Test Utils
   * This will significantly reduce performance if set to false.
   * 异步执行更新。用于Vue测试Utils
   * 如果设置为false，这将显著降低性能。
   */
  async: true,

  /**
   * Exposed for legacy reasons
   * 由于遗留原因而公开
   */
  _lifecycleHooks: LIFECYCLE_HOOKS
}: Config)
