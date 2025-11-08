<template>
  <div class="redeem-page">
    <!-- 商品區塊 -->
    <div class="product-container">
      <div class="product-grid">
        <div
          v-for="p in filteredProducts"
          :key="p.id"
          class="product-card"
          @click="openConfirm(p)"
        >
          <img :src="p.image" alt="商品圖片" class="product-image" />
          <div class="product-info">
            <h3>{{ p.name }}</h3>
            <p>{{ p.points }} 點</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部選單 -->
    <div class="bottom-nav">
      <div
        class="nav-item"
        :class="{ active: currentTag === 'all' }"
        @click="setFilter('all')"
      >
        全部
      </div>
      <div
        class="nav-item"
        :class="{ active: currentTag === 'food' }"
        @click="setFilter('food')"
      >
        飲食
      </div>
      <div
        class="nav-item"
        :class="{ active: currentTag === 'travel' }"
        @click="setFilter('travel')"
      >
        出行
      </div>
      <div
        class="nav-item"
        :class="{ active: currentTag === 'entertain' }"
        @click="setFilter('entertain')"
      >
        娛樂
      </div>
    </div>

    <!-- 彈出視窗 -->
    <div v-if="showDialog" class="dialog-overlay">
      <div class="dialog-box">
        <p v-if="!success">是否兌換「{{ selectedProduct?.name }}」？</p>
        <p v-else class="success">兌換成功！</p>

        <div class="dialog-buttons" v-if="!success">
          <button class="confirm" @click="confirmRedeem">確定</button>
          <button class="cancel" @click="closeDialog">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const currentTag = ref("all");
const showDialog = ref(false);
const success = ref(false);
const selectedProduct = ref(null);

const products = ref([
  {
    id: 1,
    name: "星巴克飲品券",
    points: 300,
    image: "././public/picture.jpeg",
    food: true,
    travel: false,
    entertain: false,
  },
  {
    id: 2,
    name: "高鐵車票折扣券",
    points: 1200,
    image: "././public/picture.jpeg",
    food: false,
    travel: true,
    entertain: false,
  },
  {
    id: 3,
    name: "電影票兌換券",
    points: 600,
    image: "././public/picture.jpeg",
    food: false,
    travel: false,
    entertain: true,
  },
  {
    id: 4,
    name: "餐廳折扣券",
    points: 500,
    image: "././public/picture.jpeg",
    food: true,
    travel: false,
    entertain: false,
  },
  {
    id: 5,
    name: "樂園入場券",
    points: 2000,
    image: "././public/picture.jpeg",
    food: false,
    travel: false,
    entertain: true,
  },
  {
    id: 6,
    name: "租車折扣券",
    points: 800,
    image: "././public/picture.jpeg",
    food: false,
    travel: true,
    entertain: false,
  },
]);

const setFilter = (tag) => {
  currentTag.value = tag;
};

const filteredProducts = computed(() => {
  if (currentTag.value === "all") return products.value;
  return products.value.filter((p) => p[currentTag.value]);
});

const openConfirm = (product) => {
  selectedProduct.value = product;
  success.value = false;
  showDialog.value = true;
};

const closeDialog = () => {
  showDialog.value = false;
};

const confirmRedeem = () => {
  success.value = true;
  setTimeout(() => {
    showDialog.value = false;
  }, 2000);
};
</script>

<style scoped>
.redeem-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f9f9f9;
}

.product-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.product-card {
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  text-align: center;
  transition: transform 0.2s;
  cursor: pointer;
}

.product-card:hover {
  transform: scale(1.03);
}

.product-image {
  width: 100%;
  height: 120px;
  object-fit: cover;
}

.product-info {
  padding: 0.5rem;
}

.bottom-nav {
  display: flex;
  justify-content: space-around;
  border-top: 1px solid #ddd;
  background: white;
  height: 60px;
  align-items: center;
  font-weight: bold;
  position: sticky;
  bottom: 0;
}

.nav-item {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  cursor: pointer;
  transition: 0.3s;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  outline: none;
}

.nav-item.active {
  color: #00bfff;
  border-top: 3px solid #00bfff;
}

.nav-item:hover {
  background: #f0f0f0;
}

/* 彈窗樣式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 200;
}

.dialog-box {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  text-align: center;
  width: 280px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
}

.dialog-buttons {
  display: flex;
  justify-content: space-around;
  margin-top: 1rem;
}

.dialog-buttons button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  transition: 0.2s;
}

.confirm {
  background-color: #00bfff;
  color: white;
}

.cancel {
  background-color: #ccc;
}

.confirm:hover {
  background-color: #0099cc;
}

.cancel:hover {
  background-color: #aaa;
}

.success {
  color: #00bfff;
  font-weight: bold;
}
</style>