const notices = document.querySelectorAll(".notice-item");

notices.forEach((item, index) => {
  item.setAttribute("data-index", index + 1);
});
