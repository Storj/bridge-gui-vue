import {
  SET_CREDITS,
  SET_DEBITS,
  SET_DEFAULT_PAYMENT_METHOD,
  SET_BILLING_DATE,
  SET_DEFAULT_PP_ID,
  SET_NEXT_BILLING_PERIOD,
  CLEAR_DEFAULT_PAYMENT_METHOD,
  MARK_RETRIEVED,
  CLEAR_BILLING,
  SET_WALLETS
} from '../mutation-types';
// import errors from 'storj-service-error-types';
import { createStripeToken } from '@/vendors/stripe';
import { lStorage, getFirstAndLastDayOfCurrentMonth } from '@/utils';
import billingClient from '@/api/billing-client';

// TODO: break out processors and payments into submodule of billing
const state = {
  retrieved: false,
  credits: [],
  debits: [],
  wallets: {},
  defaultPaymentMethod: {},
  defaultPPId: '',
  billingDate: null,
  nextBillingPeriod: {}
};

const mutations = {
  [SET_CREDITS] (state, credits) {
    state.credits = credits;
  },

  [SET_DEBITS] (state, debits) {
    state.debits = debits;
  },

  [SET_DEFAULT_PAYMENT_METHOD] (state, method) {
    state.defaultPaymentMethod = method;
  },

  [CLEAR_DEFAULT_PAYMENT_METHOD] (state) {
    state.defaultPaymentMethod = {};
  },

  [SET_BILLING_DATE] (state, date) {
    state.billingDate = date;
  },

  [SET_DEFAULT_PP_ID] (state, id) {
    state.defaultPPId = id;
  },

  [SET_NEXT_BILLING_PERIOD] (state, period) {
    state.nextBillingPeriod = period;
  },

  [MARK_RETRIEVED] (state) {
    state.retrieved = true;
  },

  [SET_WALLETS] (state, wallets) {
    state.wallets = wallets;
  },

  [CLEAR_BILLING] (state) {
    state.retrieved = false;
    state.credits = [];
    state.debits = [];
    state.defaultPaymentMethod = {};
    state.billingDate = null;
    state.defaultPPId = '';
  }
};

const actions = {
  getCredits ({ commit, dispatch }, params = {}) {
    return new Promise((resolve, reject) => {
      params.user = lStorage.retrieve('email');
      billingClient.request('GET', '/credits', params)
        .then((res) => resolve(commit(SET_CREDITS, res.data)))
        .catch((err) => reject(err));
    });
  },

  getDebits ({ commit, dispatch }, params = {}) {
    return new Promise((resolve, reject) => {
      const dateRange = getFirstAndLastDayOfCurrentMonth();
      params.user = lStorage.retrieve('email');
      params.startDate = dateRange.startDate;
      params.endDate = dateRange.endDate;
      billingClient.request('GET', '/debits', params)
        .then((res) => resolve(commit(SET_DEBITS, res.data)))
        .catch((err) => reject(err));
    });
  },

  createWallet ({ commit, dispatch }, currency) {
    return new Promise((resolve, reject) => {
      billingClient.request('POST', '/pp/wallets', {
        currency: currency
      })
      .then((res) => {
        dispatch('getWallets');
        return resolve(res.data);
      })
      .catch((err) => reject(err));
    });
  },

  getWallets ({ commit }) {
    return new Promise((resolve, reject) => {
      billingClient.request('GET', '/pp/wallets')
        .then((res) => {
          if (!res.data.length || !res.data) {
            return resolve(commit(SET_WALLETS, {}));
          }
          return resolve(commit(SET_WALLETS, res.data));
        })
        .catch((err) => reject(err));
    });
  },

  _setPaymentInfo ({ commit }, data) {
    if (data && data.pp) {
      commit(SET_DEFAULT_PAYMENT_METHOD, data.pp.defaultPaymentMethod);
      commit(SET_BILLING_DATE, data.pp.billingDate);
      commit(SET_DEFAULT_PP_ID, data.pp.id);
      commit(SET_NEXT_BILLING_PERIOD, data.pp.nextBillingPeriod);
    } else {
      commit(SET_DEFAULT_PAYMENT_METHOD, {});
      commit(SET_BILLING_DATE, null);
      commit(SET_DEFAULT_PP_ID, '');
      commit(SET_NEXT_BILLING_PERIOD, {});
    }
  },

  removePaymentMethod ({ commit, dispatch, state }) {
    return new Promise((resolve, reject) => {
      billingClient.request('POST', '/pp/method/remove', {
        methodId: state.defaultPaymentMethod.id,
        ppId: state.defaultPPId
      })
      .then((res) => resolve(dispatch('_setPaymentInfo')))
      .catch((err) => reject(err));
    });
  },

  addPaymentMethod ({ commit, dispatch }, opts) {
    return new Promise((resolve, reject) => {
      // TODO: Add switch/case for different processor additions
      if (opts.processor.name !== 'stripe') {
        return true;
      } else if (opts.processor.name === 'stripe') {
        createStripeToken(opts.fields).then((token) => {
          return billingClient.request('POST', '/pp/method/add', {
            data: token,
            processor: opts.processor
          })
          .then((res) => resolve(dispatch('_setPaymentInfo', {...res.data})))
          .catch((err) => reject(err));
        })
        .catch((err) => reject(err));
      }
    });
  },

  getDefaultPP ({ commit, dispatch }) {
    return new Promise((resolve, reject) => {
      billingClient.request('GET', '/pp/default')
        .then((res) => resolve(dispatch('_setPaymentInfo', {...res.data})))
        .catch((err) => reject(err));
    });
  }
};

export default {
  state,
  mutations,
  actions
};
