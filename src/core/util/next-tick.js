/* @flow */
/* globals MessageChannel */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIOS, isNative } from './env'

const callbacks = []
// pending  代表回调队列是否处于等待刷新的状态
let pending = false

// 等待调用栈被清空之后才执行
function flushCallbacks () {
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

// Here we have async deferring wrappers using both microtasks and (macro) tasks.
// In < 2.4 we used microtasks everywhere, but there are some scenarios where
// microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690) or even between bubbling of the same
// event (#6566). However, using (macro) tasks everywhere also has subtle problems
// when state is changed right before repaint (e.g. #6813, out-in transitions).
// Here we use microtask by default, but expose a way to force (macro) task when
// needed (e.g. in event handlers attached by v-on).
let microTimerFunc
let macroTimerFunc
let useMacroTask = false

// Determine (macro) task defer implementation.
// Technically setImmediate should be the ideal choice, but it's only available
// in IE. The only polyfill that consistently queues the callback after all DOM
// events triggered in the same loop is by using MessageChannel.
/* istanbul ignore if */
/*
  macroTimerFunc ==》
  macroTimerFunc 函数的作用就是将 flushCallbacks 注册为 (macro)task
*/
// setImmediate IE浏览器
// setImmediate 拥有比 setTimeout 更好的性能（setTimeout  执行之前要不停的做超时检测）
if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  macroTimerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else if (typeof MessageChannel !== 'undefined' && (
  isNative(MessageChannel) ||
  // PhantomJS
  MessageChannel.toString() === '[object MessageChannelConstructor]'
)) {
  const channel = new MessageChannel()
  const port = channel.port2
  channel.port1.onmessage = flushCallbacks
  macroTimerFunc = () => {
    port.postMessage(1)
  }
} else {
  /* istanbul ignore next */
  macroTimerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

// Determine microtask defer implementation.
/* istanbul ignore next, $flow-disable-line */
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  /*
     microTimerFunc ==》
     microTimerFunc 函数的作用就是将 flushCallbacks 注册为 microtask
   */
  // microTimerFunc 定义为一个函数，这个函数的执行将会把 flushCallbacks 函数注册为 microtask
  microTimerFunc = () => {
    p.then(flushCallbacks)
    // in problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    // 一个解决怪异问题的变通方法，
    // 在一些 UIWebViews 中存在很奇怪的问题，即 microtask 没有被刷新，
    // 对于这个问题的解决方案就是让浏览做一些其他的事情比如注册一个 (macro)task 即使这个 (macro)task 什么都不做，
    // 这样就能够间接触发 microtask 的刷新
    if (isIOS) setTimeout(noop)
  }
} else {
  // fallback to macro
  microTimerFunc = macroTimerFunc
}

/**
 * Wrap a function so that if any code inside triggers state change,
 * the changes are queued using a (macro) task instead of a microtask.
 */
export function withMacroTask (fn: Function): Function {
  return fn._withTask || (fn._withTask = function () {
    useMacroTask = true
    try {
      return fn.apply(null, arguments)
    } finally {
      useMacroTask = false
    }
  })
}
/*
注：微任务的执行优先于宏任务
  宏任务：script（全局任务）, setTimeout, setInterval, setImmediate, I/O, UI rendering.
  微任务：process.nextTick, Promise, Object.observer, MutationObserver.
 (macro)task 中两个不同的任务之间可能穿插着UI的重渲染，
 那么我们只需要在 microtask 中把所有在UI重渲染之前需要更新的数据全部更新，这样只需要一次重渲染就能得到最新的DOM
 在UI重渲染之前更新所有数据状态，对性能有很大的提升
*/
/*created 钩子中连续调用三次 $nextTick 方法，
 但只有第一次调用 $nextTick 方法时才会执行 microTimerFunc 函数将 flushCallbacks 注册为 microtask，
 但此时 flushCallbacks 函数并不会执行，
 因为它要等待接下来的两次 $nextTick 方法的调用语句执行完后才会执行，或者准确的说等待调用栈被清空之后才会执行。
 当 flushCallbacks 函数执行的时候，
 callbacks 回调队列中将包含本次事件循环所收集的所有通过 $nextTick 方法注册的回调，
 而接下来的任务就是在 flushCallbacks 函数内将这些回调全部执行并清空*/
// 例1：
  /*watch () {
   this.$nextTick(() => { console.log(1) })
   this.$nextTick(() => { console.log(2) })
   this.$nextTick(() => { console.log(3) })
  }*/

// 例2：
/* created () {
   this.name = 'HcySunYang'
   this.$nextTick(() => {
   this.name = 'hcy'
   this.$nextTick(() => { console.log('第二个 $nextTick') })
   })
 }*/
export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  // pending  代表回调队列是否处于等待刷新的状态
  if (!pending) {
    // pending 的值设置为 true，代表着此时回调队列不为空，正在等待刷新
    // 用到了 microTimerFunc 或者 macroTimerFunc 函数，
    // 这两个函数的作用是将 flushCallbacks 函数分别注册为 microtask 和 (macro)task
    pending = true
    if (useMacroTask) {
      macroTimerFunc()
    } else {
      microTimerFunc()
    }
  }
  // $flow-disable-line
  // 返回一个 promise 实例对象
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
