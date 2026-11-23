package com.sagar.forgeorder.operations.api;

import com.sagar.forgeorder.catalog.persistence.ProductRepository;
import com.sagar.forgeorder.inventory.domain.Inventory;
import com.sagar.forgeorder.inventory.persistence.InventoryRepository;
import com.sagar.forgeorder.orders.api.OrderResponse;
import com.sagar.forgeorder.orders.domain.Order;
import com.sagar.forgeorder.orders.domain.OrderStatus;
import com.sagar.forgeorder.orders.persistence.OrderRepository;
import com.sagar.forgeorder.payments.persistence.PaymentAttemptRepository;
import com.sagar.forgeorder.reconciliation.application.ReconciliationService;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final OrderRepository orderRepository;
    private final ReconciliationService reconciliationService;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final PaymentAttemptRepository paymentAttemptRepository;

    public AdminController(OrderRepository orderRepository,
                           ReconciliationService reconciliationService,
                           ProductRepository productRepository,
                           InventoryRepository inventoryRepository,
                           PaymentAttemptRepository paymentAttemptRepository) {
        this.orderRepository = orderRepository;
        this.reconciliationService = reconciliationService;
        this.productRepository = productRepository;
        this.inventoryRepository = inventoryRepository;
        this.paymentAttemptRepository = paymentAttemptRepository;
    }

    public record ProductStockResponse(
            UUID id,
            String name,
            BigDecimal price,
            BigDecimal taxRate,
            int availableQuantity,
            int reservedQuantity
    ) {}

    @GetMapping("/products")
    public List<ProductStockResponse> getProducts() {
        return productRepository.findAll().stream()
                .map(p -> {
                    Inventory inv = inventoryRepository.findById(p.getId()).orElse(null);
                    int avail = inv != null ? inv.getAvailableQuantity() : 0;
                    int res = inv != null ? inv.getReservedQuantity() : 0;
                    return new ProductStockResponse(
                            p.getId(), p.getName(), p.getPrice(), p.getTaxRate(), avail, res
                    );
                })
                .toList();
    }

    @GetMapping("/orders")
    public List<OrderResponse> getOrdersByStatus(@RequestParam(required = false) OrderStatus status) {
        List<Order> orders = (status != null)
                ? orderRepository.findByStatus(status)
                : orderRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));

        return orders.stream()
                .map(order -> {
                    OrderResponse.InventorySummary invSummary = inventoryRepository.findById(order.getProductId())
                            .map(i -> new OrderResponse.InventorySummary(i.getAvailableQuantity(), i.getReservedQuantity()))
                            .orElse(null);

                    OrderResponse.PaymentSummary paySummary = paymentAttemptRepository
                            .findFirstByOrderIdOrderByCreatedAtDesc(order.getId())
                            .map(pa -> new OrderResponse.PaymentSummary(
                                    pa.getStatus().name(), pa.getProviderPaymentId(), pa.getDeclineReason(), pa.getIdempotencyKey()))
                            .orElse(null);

                    return OrderResponse.from(order, invSummary, paySummary);
                })
                .toList();
    }

    @PostMapping("/orders/{id}/reconcile")
    public String triggerReconciliation(@PathVariable UUID id) {
        reconciliationService.reconcileOrder(id);
        return "Reconciliation triggered for order: " + id;
    }
}
