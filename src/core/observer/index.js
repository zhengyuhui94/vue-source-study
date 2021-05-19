/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any; // data 对象
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep() // 收集依赖的实例
    this.vmCount = 0
    def(value, '__ob__', this) // def 定义对象下的某个属性值
    if (Array.isArray(value)) {
      if (hasProto) { // hasProto 用来检测当前环境是否可以使用 __proto__ 属性
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      // 为了使嵌套的数组或对象同样是响应式数据，我们需要递归的观测那些类型为数组或对象的数组元素，而这就是 observeArray 方法的作用
      this.observeArray(value)
    } else {
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
  /* const ins = new Vue({
      data: {
        arr: [
          [1, 2]
        ]
      }
    })

    ins.arr.push(1) // 能够触发响应
    ins.arr[0].push(3) // 不能触发响应
  */
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  // 该变量用来保存 Observer 实例，可以发现 observe 函数的返回值就是 ob
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
// 数据响应系统对纯对象和数组的处理方式是不同，
// 对于纯对象只需要逐个将对象的属性重新定义为访问器属性，
// 并且当属性的值同样为纯对象时进行递归定义即可，
// 而对于数组的处理则是通过拦截数组变异方法的方式
// 也就是说如下代码是触发不了响应的：
// const ins = new Vue({
//   data: {
//     arr: [1, 2]
//   }
// })
//
// ins.arr[0] = 3  // 不能触发响应
// 因为数组的索引不是”访问器属性“，
// 所以当有观察者依赖数组的某一个元素时是触发不了这个元素的 get 函数的，
// 当然也就收集不到依赖。这个时候就是 dependArray 函数发挥作用的时候
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  const dep = new Dep()

  //  {
  //    value: 123,
  //    writable: true,
  //    enumerable: true,
  //    configurable: true
  //  }
  // 获取该属性的描述对象
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  let childOb = !shallow && observe(val)  // new Observer()
  // 每一个数据字段都通过闭包引用着属于自己的 dep 常量
  Object.defineProperty(obj, key, {
    enumerable: true, // 当其值为true时，该属性才能够出现在对象的枚举属性中，默认为false
    configurable: true, // 当且仅当configurable为true时，该属性描述符才能够被改变，也能被删除
    get: function reactiveGetter () {
      /*const data = {
        a: {
          b: 1
        }
      }
      该数据对象经过观测处理之后，将被添加__ob__属性，如下
      const data = {
        a: {
          b: 1,
          __ob__: {value, dep, vmCount} // 第二个”筐“里收集的依赖的触发时机是在使用 $set 或 Vue.set 给数据对象添加新属性时触发
        },
        __ob__: {value, dep, vmCount} // 第一个”筐“里收集的依赖的触发时机是当属性值被修改时触发，即在 set 函数中触发：dep.notify()
      }
       Vue.set = function (obj, key, val) {
         defineReactive(obj, key, val)
         obj.__ob__.dep.notify() // 相当于 data.a.__ob__.dep.notify()
       }
       Vue.set(data.a, 'c', 1)
      */
      // 被读取的属性
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        dep.depend()  // 执行 dep 对象的 depend 方法将依赖收集到 dep 这个“筐”中
        if (childOb) {  // childOb.dep === data.a.__ob__.dep === new Dep()
          childOb.dep.depend()  /*这里闭包引用了上面的 dep 常量*/
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      dep.notify() /*这里闭包引用了上面的 dep 常量*/
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' && (isUndef(target) || isPrimitive(target)) ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()  // 调用 e.__ob__.dep.depend() 达到收集依赖的目的
    if (Array.isArray(e)) {
      dependArray(e)  // 递归调用 dependArray 继续收集依赖
    }
  }
}
