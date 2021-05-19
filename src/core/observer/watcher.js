/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component, // 组件实例对象 vm
    expOrFn: string | Function, // 要观察的表达式 expOrFn
    cb: Function, // 当被观察的表达式的值变化时的回调函数 cb
    options?: ?Object, // 传递给当前观察者对象的选项 options
    isRenderWatcher?: boolean // 用来标识该观察者实例是否是渲染函数的观察者
  ) {
    // 将当前组件实例对象 vm 赋值给该观察者实例的 this.vm 属性
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this // 在 initLifecycle 方法中初始化为null
    }
    vm._watchers.push(this) // 在 initState 方法中初始化为[]
    // options
    if (options) {
      this.deep = !!options.deep // 用来告诉当前观察者实例对象是否是深度观测
      this.user = !!options.user // 用来标识当前观察者实例对象是 开发者定义的 还是 内部定义的
      this.lazy = !!options.lazy // 属性是用来判断该观察者是不是计算属性的观察者
      // 默认情况下当数据变化时不会同步求值并执行回调，
      // 而是将需要重新求值并执行回调的观察者放到一个异步队列中，
      // 当所有数据的变化结束之后统一求值并执行回调
      this.sync = !!options.sync // 用来告诉观察者当数据变化时是否同步求值并执行回调
      // 可以理解为 Watcher 实例的钩子，
      // 当数据变化之后，触发更新之前，
      // 调用在创建渲染函数的观察者实例对象时传递的 before 选项
      this.before = options.before // beforeUpdate
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching  观察者实例对象的唯一标识
    this.active = true // 标识着该观察者实例对象是否是激活状态
    this.dirty = this.lazy // for lazy watchers
    // <-- 用来实现避免收集重复依赖，且移除无用依赖
    // newDepIds 属性用来避免在 一次求值 的过程中收集重复的依赖，
    // depIds 属性是用来在 多次求值 中避免收集重复依赖的
    //
    // 1、newDepIds 属性用来在一次求值中避免收集重复的观察者
    // 2、每次求值并收集观察者完成之后会清空 newDepIds 和 newDeps 这两个属性的值，并且在被清空之前把值分别赋给了 depIds 属性和 deps 属性
    // 3、depIds 属性用来避免重复求值时收集重复的观察者
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    // -->
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    this.value = this.lazy // 计算属性的观察者
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   * 计算getter，并重新收集依赖项。
   */
  get () {
    // Dep.target 赋值为当前的渲染 watcher
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        // 递归去访问 value，触发它所有子项的 getter
        traverse(value)
      }
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep (dep: Dep) {
    const id = dep.id
    // dep.id 属性检测该 Dep 实例对象是否已经存在于 newDepIds 中，如果存在那么说明已经收集过依赖了，什么都不会做
    // 这样无论一个数据属性被读取了多少次，对于同一个观察者它只会收集一次
    // 避免收集重复依赖
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   * 清理依赖项收集。
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      // 不存在则说明该 Dep 实例对象已经和该观察者不存在依赖关系了，
      // 这时就会调用 dep.removeSub(this) 方法并以该观察者实例对象作为参数传递，
      // 从而将该观察者对象从 Dep 实例对象中移除
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) { // 同this.computed
      this.dirty = true
    } else if (this.sync) {  // 同步更新
      this.run()
    } else {  // 一般情况，会走到异步更新这一步
      // queueWatcher 函数的作用是将观察者放到一个队列中等待所有突变完成之后统一执行更新
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  //无论是同步更新变化还是将更新变化的操作放到异步更新队列，
  //真正的更新变化操作都是通过调用观察者实例对象的 run 方法完成的
  run () {
    if (this.active) {
      //对于渲染函数的观察者来讲，重新求值其实等价于重新执行渲染函数，
      //最终结果就是重新生成了虚拟DOM并更新真实DOM，这样就完成了重新渲染的过程
      const value = this.get()
      // 对于渲染函数的观察者来讲并不会执行这个 if 语句块，
      // 因为 this.get 方法的返回值其实就等价于 updateComponent 函数的返回值，
      // 这个值将永远都是 undefined。
      // if 语句块内的代码是为非渲染函数类型的观察者准备的，
      // 它用来对比新旧两次求值的结果，当值不相等的时候会调用通过参数传递进来的回调
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        // this.user 为真意味着这个观察者是开发者定义的
        // 通过 watch 选项或 $watch 函数定义的观察者
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      // vm._isBeingDestroyed 属性，它是一个标识，为真说明该组件实例已经被销毁了，为假说明该组件还没有被销毁
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
